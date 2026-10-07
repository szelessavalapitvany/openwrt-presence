module("luci.controller.smarthome.presence", package.seeall)

function index()
        entry({"admin", "smarthome"}, firstchild(), translate("Smart home"), 60).dependent = false

        entry({"wifi-presence"}, call("action_wifi_presence"), nil, 1).leaf = true
        entry({"presence"}, call("action_presence"), nil, 1).leaf = true
end


function get_current_wifi_clients()
        local u = require "luci.util"
        local assocList = {}
        local wireless = u.ubus("network.wireless", "status", {}) or {}

        for k,v in pairs(wireless) do
                if v.interfaces then
                        for a,b in pairs(v.interfaces) do
                                if b.ifname then
                                        local clients = u.ubus("hostapd." .. b.ifname, "get_clients", {}) or {}

                                        if clients.clients then
                                                for c,d in pairs(clients.clients) do
                                                        assocList[string.upper(c)] = true
                                                end
                                        end
                                end
                        end
                end
        end

        return assocList
end


function get_dhcp_macaddr_by_hostname()
        local u = require "luci.util"
        local result = u.ubus("luci-rpc", "getDHCPLeases", {}) or {}
        local dhcp = result.dhcp_leases or {}
        local hosts = {}

        for k,v in pairs(dhcp) do
                if v.hostname and v.macaddr then
                        hosts[string.upper(v.hostname)] = string.upper(v.macaddr)
                end
        end

        return hosts
end


function get_ip_by_macaddr(macaddr)
        local u = require "luci.util"

        if not macaddr then
                return nil
        end

        local result = u.ubus("luci-rpc", "getDHCPLeases", {}) or {}
        local dhcp = result.dhcp_leases or {}

        for k,v in pairs(dhcp) do
                if v.macaddr and string.upper(v.macaddr) == string.upper(macaddr) then
                        return v.ipaddr
                end
        end

        local out = u.exec("ip neigh show")

        for line in out:gmatch("[^\r\n]+") do
                local ip, mac = line:match("^(%S+).-[Ll][Ll][Aa][Dd][Dd][Rr]%s+(%S+)")

                if ip and mac and string.upper(mac) == string.upper(macaddr) then
                        return ip
                end
        end

        return nil
end


function action_wifi_presence(group)
        if not group then
                luci.http.status(404, "Group not defined in URL")
                return
        end

        local uci = require "luci.model.uci".cursor()

        if uci:get("wifi_presence", "global", "enabled") ~= "1" then
                luci.http.status(404, "Wifi presence detection disabled")
                return
        end

        local foundSection = nil

        uci:foreach("wifi_presence", "presence",
                function(section)
                        if section.name == group then
                                foundSection = section
                        end
                end
        )

        if not foundSection then
                luci.template.render("smarthome/presence", {response = "nogroup"})
                return
        end

        if foundSection.enabled ~= "1" then
                luci.http.status(404, "Client group " .. group .. " detection is disabled")
                return
        end

        local resp = "false"

        if foundSection.wifi_client then
                local wifiClients = get_current_wifi_clients()
                local dhcpClients = get_dhcp_macaddr_by_hostname()

                for k,v in pairs(foundSection.wifi_client) do
                        local mac = dhcpClients[string.upper(v)]

                        if mac and wifiClients[mac] then
                                resp = "true"
                                break
                        end
                end

                if resp ~= "true" then
                        uci:foreach("accesspoints", "accesspoint",
                                function(section)
                                        if resp == "true" or section.enabled ~= "1" then
                                                return
                                        end

                                        local ipaddr = get_ip_by_macaddr(section.macaddress)

                                        if not ipaddr then
                                                return
                                        end

                                        local endpoint = section.endpoint or "/cgi-bin/luci/get-wifi-clients"
                                        local protocol = section.protocol or "http"

                                        local s = require "luci.sys"
                                        local j = require "luci.jsonc"

                                        local out = s.exec(
                                                "curl -s " ..
                                                protocol .. "://" ..
                                                ipaddr ..
                                                endpoint ..
                                                " 2>/dev/null"
                                        )

                                        local data = j.parse(out)

                                        if data then
                                                for k,v in pairs(foundSection.wifi_client) do
                                                        local mac = dhcpClients[string.upper(v)]

                                                        if mac then
                                                                for k1,v1 in pairs(data) do
                                                                        if string.upper(v1) == mac then
                                                                                resp = "true"
                                                                                return
                                                                        end
                                                                end
                                                        end
                                                end
                                        end
                                end
                        )
                end
        end

        luci.template.render("smarthome/presence", {response = resp})
end


function get_dhcp_ipaddr_by_macaddr()
        local u = require "luci.util"
        local result = u.ubus("luci-rpc", "getDHCPLeases", {}) or {}
        local dhcp = result.dhcp_leases or {}
        local hosts = {}

        for k,v in pairs(dhcp) do
                if v.macaddr and v.ipaddr then
                        hosts[string.upper(v.macaddr)] = v.ipaddr
                end
        end

        return hosts
end


function ping_host(ipaddress, timeout)
        local fs = require "nixio.fs"
        local sys = require "luci.sys"
        local command

        if fs.access("/usr/bin/ping", "x") then
                command = "/usr/bin/ping -c 1 -W " .. timeout .. " " .. ipaddress .. " >/dev/null 2>&1"
        else
                command = "ping -c 1 -W 1 " .. ipaddress .. " >/dev/null 2>&1"
        end

        return sys.call(command) == 0
end


function action_presence(group)
        if not group then
                luci.http.status(404, "Group not defined in URL")
                return
        end

        local uci = require "luci.model.uci".cursor()

        if uci:get("presence", "global", "enabled") ~= "1" then
                luci.http.status(404, "Presence detection disabled")
                return
        end

        local foundSection = nil

        uci:foreach("presence", "presence",
                function(section)
                        if section.name == group then
                                foundSection = section
                        end
                end
        )

        if not foundSection then
                luci.template.render("smarthome/presence", {response = "nogroup"})
                return
        end

        if foundSection.enabled ~= "1" then
                luci.http.status(404, "Client group " .. group .. " detection is disabled")
                return
        end

        local resp = "false"

        if foundSection.client then
                local dhcpClients = get_dhcp_ipaddr_by_macaddr()
                local ping_timeout = tonumber(
                        uci:get("presence", "global", "ping_timeout")
                ) or 200

                local timeout = tostring(ping_timeout / 1000)

                for k,v in pairs(foundSection.client) do
                        local ip = dhcpClients[string.upper(v)]

                        if ip and ping_host(ip, timeout) then
                                resp = "true"
                                break
                        end
                end
        end

        luci.template.render("smarthome/presence", {response = resp})
end
