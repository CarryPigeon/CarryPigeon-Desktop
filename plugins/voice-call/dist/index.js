import { defineComponent } from "/vendor/vendor.mjs";
var manifest_default = {
	pluginId: "voice-call",
	version: "0.1.0",
	entry: "index.js",
	permissions: [
		"invoke",
		"events",
		"ui",
		"storage"
	],
	providesDomains: ["call_record"]
};
//#endregion
//#region plugins/voice-call/src/manifest.ts
var voiceCallManifest = manifest_default;
manifest_default.pluginId;
manifest_default.version;
//#endregion
//#region plugins/voice-call/src/index.ts
var manifest = voiceCallManifest;
var renderers = { call_record: defineComponent({
	name: "VoiceCallPlaceholder",
	render: () => null
}) };
function activate(_ctx) {}
function deactivate() {}
//#endregion
export { activate, deactivate, manifest, renderers };
