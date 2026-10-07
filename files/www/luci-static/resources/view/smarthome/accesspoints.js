'use strict';
'require form';
'require view';
'require rpc';
'require network';

var callLuciDHCPLeases = rpc.declare({
        object: 'luci-rpc',
        method: 'getDHCPLeases',
        expect: { '': {} }
});

return view.extend({
	load: function() {
		return callLuciDHCPLeases();
	},

	render: function(data) {
		var dhcp_leases = data.dhcp_leases;
		console.debug(dhcp_leases);
		var m, s, o;
		var a;
		m = new form.Map('accesspoints', _('Wifi access points on LAN'), _('You can configure the connected access points for detecting wifi presence.') + '<br /><br /><h5>' + _("Attention! Only those access points are supported, which returns the connected wifi clients MAC addresses in JSON array format on the defined REST endpoint! E.g.: [\"11:22:33:44:55:66\",\"AA:BB:CC:DD:EE:FF\",\"FF:EE:DD:CC:BB:AA\"]"));
		
		s = m.section(form.TypedSection, 'accesspoint', _('Access points'), _('You can add multiple access points to the configuration.'))
		s.addremove = true;
		s.addbtntitle = _('Add')

                o = s.option(form.Flag, 'enabled', _('Enable'));
                o.default = true;
                o.rmempty = false;

		o = s.option(form.ListValue, 'protocol', _('Protocol'));
		o.value('http', 'http')
		o.value('https', 'https')
		o.default = 'http';

		o = s.option(form.Value, 'macaddress', _('MAC address'))
		o.datatype = "unique(macaddr)"
		o.rmempty = true;
		var hostname;
		for (var i =0; i<dhcp_leases.length; i++) {
			o.value(dhcp_leases[i].macaddr, dhcp_leases[i].macaddr + " (" + (typeof dhcp_leases[i].hostname === "undefined" ? _('Unknown') : dhcp_leases[i].hostname) + " - " + dhcp_leases[i].ipaddr + ")");
		}
		
		o = s.option(form.Value, 'endpoint', _('REST endpoint'))
		o.placeholder = _('/cgi-bin/luci/get-wifi-clients')
		return m.render();
	}
});
