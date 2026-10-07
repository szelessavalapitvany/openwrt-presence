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
		m = new form.Map('presence', _('Presence'), _('You can configure the presence function.') + '<br /><br /><h5>' + _("Attention! Only clients request IP Address from the router DHCP server can be detected!") + '<br />' + _('For use this method, you must turn off the randomized MAC address on your clients') + ' (<a href="https://www.howtogeek.com/722653/how-to-disable-random-wi-fi-mac-address-on-android/"><b>Android</b></a>, <a href="https://support.apple.com/en-us/HT211227"><b>Apple</b></a>).</h5><br />' + _("You can check if at least one of the clients in group is active at the URL") + ' <a href="' + window.location.origin + '/cgi-bin/luci/presence/groupname"><b>' + window.location.origin + '/cgi-bin/luci/presence/{' + _("group name") + '}</b></a><br />'+_("You must replace the <b>group name</b> with one below defined client group name.") + '<br />' + _("The URL return with HTTP 200 status code and <b>true/false</b> values on success, or HTTP 404 status code with the error message on error."));
		s = m.section(form.TypedSection, 'global', _('Global Settings'));
		s.anonymous = true;
	
		o = s.option(form.Flag, 'enabled', _('Enable'));

		o = s.option(form.Value, 'ping_timeout', _('Ping timeout'), _('This method detect the client availability with <b>ping</b> command. The timeout value is in milliseconds.'));
		o.datatype = "range(10, 2000)";
		o.rmempty = false;
		o.default = 100;

		s = m.section(form.TypedSection, 'presence', _('Client groups'), _('You can define a groups of %sclients, add more clients to it. One client can belong to more group.').format(''));
		s.addremove = true;
		s.anonymous = true;
		s.addbtntitle = _('Create new group');

		o = s.option(form.Value, 'name', '<h3>' + _('Name') + '</h3>');
		o.rmempty = false;
		o.datatype = "uciname";
		o.placeholder = _("Unnamed");

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = true;
		o.rmempty = false;
		
		o = s.option(form.DynamicList, 'client', _('Client MAC address'));
		o.datatype = "unique(macaddr)";
		var hostname;
		for (var i =0; i<dhcp_leases.length; i++) {
			o.value(dhcp_leases[i].macaddr, dhcp_leases[i].macaddr + " (" + (typeof dhcp_leases[i].hostname === "undefined" ? _('Unknown') : dhcp_leases[i].hostname) + " - " + dhcp_leases[i].ipaddr + ")");
		}
		return m.render();
	}
});
