#!/bin/sh

set -e

BASE_URL="https://raw.githubusercontent.com/szelessavalapitvany/openwrt-presence/main"
TMP_DIR="/tmp/presence-install"

echo "Presence installer"
echo "Source: $BASE_URL"

if command -v apk >/dev/null 2>&1; then
        PKG_MANAGER="apk"
elif command -v opkg >/dev/null 2>&1; then
        PKG_MANAGER="opkg"
else
        echo "Error: neither apk nor opkg package manager found."
        exit 1
fi

echo "Package manager: $PKG_MANAGER"

install_packages() {
        if [ "$PKG_MANAGER" = "apk" ]; then
                apk update
                apk add luci luci-compat curl iputils-ping
        else
                opkg update
                opkg install luci luci-compat curl iputils-ping
        fi
}

install_packages

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

FILES="
etc/config/accesspoints
etc/config/presence
etc/config/wifi_presence
usr/lib/lua/luci/controller/smarthome/presence.lua
usr/lib/lua/luci/view/smarthome/presence.htm
usr/lib/lua/luci/i18n/smarthome.hu.lmo
usr/share/luci/menu.d/smarthome.json
usr/share/luci/menu.d/smarthome-accesspoints.json
usr/share/luci/menu.d/smarthome-presence.json
usr/share/luci/menu.d/smarthome-wifi-presence.json
usr/share/rpcd/acl.d/luci-app-smarthome-presence.json
www/luci-static/resources/view/smarthome/accesspoints.js
www/luci-static/resources/view/smarthome/presence.js
www/luci-static/resources/view/smarthome/wifi-presence.js
"

for FILE in $FILES; do
        mkdir -p "$TMP_DIR/$(dirname "$FILE")"

        echo "Downloading: $FILE"

        curl -fL \
                "$BASE_URL/files/$FILE" \
                -o "$TMP_DIR/$FILE"
done

echo "Installing files..."

for FILE in $FILES; do
        mkdir -p "/$(dirname "$FILE")"
        if [ -f "/$FILE" ] && echo "$FILE" | grep -q "^etc/config/"; then
                echo "Keeping existing config: /$FILE"
        else
                cp "$TMP_DIR/$FILE" "/$FILE"
        fi
done

rm -rf /tmp/luci-indexcache
rm -rf /tmp/luci-modulecache

/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart

rm -rf "$TMP_DIR"

echo "Presence installation completed."
