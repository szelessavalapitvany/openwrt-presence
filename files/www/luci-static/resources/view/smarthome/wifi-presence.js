'use strict';
'require form';
'require view';
'require rpc';
'require network';
'require uci';
'require request';

var callLuciDHCPLeases = rpc.declare({
        object: 'luci-rpc',
        method: 'getDHCPLeases',
        expect: { '': {} }
});

var callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			network.getWifiNetworks(),
			callLuciDHCPLeases(),
			uci.load('accesspoints').then(function() {
				let aps = [];
				let sections = uci.sections('accesspoints', 'accesspoint');
				for (var i = 0; i < sections.length; i++) {
					if (sections[i].enabled == '1') {
						let endpoint = '/cgi-bin/luci/get-wifi-clients';
						if (sections[i].endpoint != undefined) {
							endpoint = sections[i].endpoint;
						}
						aps.push({protocol: sections[i].protocol, mac: sections[i].macaddress, endpoint: endpoint});
					}
				}
				return aps;
			})
		]).then(function(data) {
			var assocList = [];

			for (var i = 0; i < data[0].length; i++)
				assocList.push(L.resolveDefault(data[0][i].getAssocList(), []).then(L.bind(function(net, list) {
					net.assoclist = list.sort(function(a, b) { return a.mac > b.mac });
				}, this, data[0][i])));

			for (var i = 0; i < data[2].length; i++) {
				var apIP = data[1].dhcp_leases.find((element) => element.macaddr == data[2][i].mac);
				if (apIP) {
					assocList.push(request.get(data[2][i].protocol + '://'+apIP.ipaddr + data[2][i].endpoint).then(L.bind(function(ap, response) {
						if (response.ok) {
							ap.clients = response.json();
						}
					}, this, data[2][i]))
					.catch(function(error) {
						console.log(error)
					}));
				}
			}


			return Promise.all(assocList).then(function() {
				return data;
			});
		});
		
	},

	render: function(data) {
		console.debug("data");
		console.debug(data);
		let wifiClients = [];
		var assocList = [];
		for (var i = 0; i<data[0].length; i++) {
			for (var j = 0; j<data[0][i].assoclist.length; j++) {
				assocList.push(data[0][i].assoclist[j].mac);
			}
		}
		for (var i = 0; i<data[2].length; i++) {
			if (data[2][i].clients) {
				for (var j = 0; j<data[2][i].clients.length; j++) {
					if (!assocList.includes(data[2][i].clients[j])) {
						assocList.push(data[2][i].clients[j]);
					}
				}
			}
		}
		for (var i = 0; i<data[1].dhcp_leases.length; i++) {
			if (assocList.includes(data[1].dhcp_leases[i].macaddr)) {
				wifiClients.push(data[1].dhcp_leases[i]);
			}
		}
		console.debug("wifiClients");
		console.debug(wifiClients);
		var m, s, o;
		var a;
		m = new form.Map('wifi_presence', _('Wifi presence'), _('You can configure the wifi presence function.') + '<br /><br /><h5>' + _("Attention! Only clients connected to the router's wifi or to the defined access points can be detected!") + '</h5><br />' + _("You can check if at least one of the clients in group is active at the URL") + ' <a href="' + window.location.origin + '/cgi-bin/luci/wifi-presence/groupname"><b>' + window.location.origin + '/cgi-bin/luci/wifi-presence/{' + _("group name") + '}</b></a><br />'+_("You must replace the <b>group name</b> with one below defined client group name.") + '<br />' + _("The URL return with HTTP 200 status code and <b>true/false</b> values on success, or HTTP 404 status code with the error message on error."));
		s = m.section(form.TypedSection, 'global', _('Global Settings'))
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.optional = false;

		s = m.section(form.TypedSection, 'presence', _('Client groups'), _('You can define a groups of %sclients, add more clients to it. One client can belong to more group.').format('wifi '));
		s.addremove = true;
		s.anonymous = true;
		s.addbtntitle = _('Create new group');

		o = s.option(form.Value, 'name', '<h3>' + _('Name') + '</h3>');
		o.datatype = "uciname";
		o.rmempty = false;
		o.placeholder = _("Unnamed");

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = true;
		o.optional = false;
		o.rmempty = false;
		
		o = s.option(form.DynamicList, 'wifi_client', _('Client hostname'))
		o.datatype = "unique(hostname)"
		for (var i =0; i<wifiClients.length; i++) {
			if (typeof wifiClients[i].hostname !== 'undefined') {
				o.value(wifiClients[i].hostname, wifiClients[i].hostname + " (" + wifiClients[i].ipaddr + " - " + wifiClients[i].macaddr + ")");
			}
		}
		return m.render();
	}
});
