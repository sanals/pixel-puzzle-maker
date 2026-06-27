"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportTestMultiPlate = exportTestMultiPlate;
var jszip_1 = __importDefault(require("jszip"));
function exportTestMultiPlate() {
    return __awaiter(this, void 0, void 0, function () {
        var zip, boxXml, mainXml, modelSettingsXml, projectSettingsXml, sliceInfoXml, relsXml, modelRelsXml, contentTypesXml;
        return __generator(this, function (_a) {
            zip = new jszip_1.default();
            boxXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<model unit=\"millimeter\" xml:lang=\"en-US\" xmlns=\"http://schemas.microsoft.com/3dmanufacturing/core/2015/02\">\n  <resources>\n    <object id=\"1\" type=\"model\">\n      <mesh>\n        <vertices>\n          <vertex x=\"0\" y=\"0\" z=\"0\"/>\n          <vertex x=\"10\" y=\"0\" z=\"0\"/>\n          <vertex x=\"10\" y=\"10\" z=\"0\"/>\n          <vertex x=\"0\" y=\"10\" z=\"0\"/>\n          <vertex x=\"0\" y=\"0\" z=\"10\"/>\n          <vertex x=\"10\" y=\"0\" z=\"10\"/>\n          <vertex x=\"10\" y=\"10\" z=\"10\"/>\n          <vertex x=\"0\" y=\"10\" z=\"10\"/>\n        </vertices>\n        <triangles>\n          <triangle v1=\"0\" v2=\"2\" v3=\"1\"/>\n          <triangle v1=\"0\" v2=\"3\" v3=\"2\"/>\n          <triangle v1=\"4\" v2=\"5\" v3=\"6\"/>\n          <triangle v1=\"4\" v2=\"6\" v3=\"7\"/>\n          <triangle v1=\"0\" v2=\"1\" v3=\"5\"/>\n          <triangle v1=\"0\" v2=\"5\" v3=\"4\"/>\n          <triangle v1=\"1\" v2=\"2\" v3=\"6\"/>\n          <triangle v1=\"1\" v2=\"6\" v3=\"5\"/>\n          <triangle v1=\"2\" v2=\"3\" v3=\"7\"/>\n          <triangle v1=\"2\" v2=\"7\" v3=\"6\"/>\n          <triangle v1=\"3\" v2=\"0\" v3=\"4\"/>\n          <triangle v1=\"3\" v2=\"4\" v3=\"7\"/>\n        </triangles>\n      </mesh>\n    </object>\n  </resources>\n</model>";
            zip.folder("3D").folder("Objects").file("object_1.model", boxXml);
            mainXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<model unit=\"millimeter\" xml:lang=\"en-US\" xmlns=\"http://schemas.microsoft.com/3dmanufacturing/core/2015/02\" xmlns:p=\"http://schemas.bambulab.com/package/2021\" requiredextensions=\"p\">\n  <resources>\n    <object id=\"2\" p:UUID=\"00000002-61cb-4c03-9d28-80fed5dfa1dc\" type=\"model\">\n      <components>\n        <component p:path=\"/3D/Objects/object_1.model\" objectid=\"1\" p:UUID=\"10000001-b206-40ff-9872-83e8017abed1\" transform=\"1 0 0 0 1 0 0 0 1 128 128 0\"/>\n      </components>\n    </object>\n    <object id=\"3\" p:UUID=\"00000003-61cb-4c03-9d28-80fed5dfa1dc\" type=\"model\">\n      <components>\n        <component p:path=\"/3D/Objects/object_1.model\" objectid=\"1\" p:UUID=\"10000002-b206-40ff-9872-83e8017abed1\" transform=\"1 0 0 0 1 0 0 0 1 128 128 0\"/>\n      </components>\n    </object>\n  </resources>\n  <build>\n    <!-- Objects spaced out by 432 mm (Bambu Studio plate spacing). 128 is center of first A1 plate. -->\n    <item objectid=\"2\" p:UUID=\"20000001-b1ec-4553-aec9-835e5b724bb4\" transform=\"1 0 0 0 1 0 0 0 1 128 128 0\" printable=\"1\"/>\n    <item objectid=\"3\" p:UUID=\"20000002-b1ec-4553-aec9-835e5b724bb4\" transform=\"1 0 0 0 1 0 0 0 1 560 128 0\" printable=\"1\"/>\n  </build>\n</model>";
            zip.folder("3D").file("3dmodel.model", mainXml);
            modelSettingsXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<config>\n  <object id=\"2\">\n    <metadata key=\"name\" value=\"Test Box 1\"/>\n    <metadata key=\"extruder\" value=\"1\"/>\n    <part id=\"1\" subtype=\"normal_part\">\n      <metadata key=\"name\" value=\"Test Box 1\"/>\n      <metadata key=\"matrix\" value=\"1 0 0 128 0 1 0 128 0 0 1 0 0 0 0 1\"/>\n      <metadata key=\"source_file\" value=\"object_1.model\"/>\n    </part>\n  </object>\n  <object id=\"3\">\n    <metadata key=\"name\" value=\"Test Box 2\"/>\n    <metadata key=\"extruder\" value=\"1\"/>\n    <part id=\"2\" subtype=\"normal_part\">\n      <metadata key=\"name\" value=\"Test Box 2\"/>\n      <metadata key=\"matrix\" value=\"1 0 0 128 0 1 0 128 0 0 1 0 0 0 0 1\"/>\n      <metadata key=\"source_file\" value=\"object_1.model\"/>\n    </part>\n  </object>\n  <plate>\n    <metadata key=\"plater_id\" value=\"1\"/>\n    <metadata key=\"plater_name\" value=\"Plate 1\"/>\n    <metadata key=\"locked\" value=\"false\"/>\n    <model_instance>\n      <metadata key=\"object_id\" value=\"2\"/>\n      <metadata key=\"instance_id\" value=\"0\"/>\n      <metadata key=\"identify_id\" value=\"10002\"/>\n    </model_instance>\n  </plate>\n  <plate>\n    <metadata key=\"plater_id\" value=\"2\"/>\n    <metadata key=\"plater_name\" value=\"Plate 2\"/>\n    <metadata key=\"locked\" value=\"false\"/>\n    <model_instance>\n      <metadata key=\"object_id\" value=\"3\"/>\n      <metadata key=\"instance_id\" value=\"0\"/>\n      <metadata key=\"identify_id\" value=\"10003\"/>\n    </model_instance>\n  </plate>\n  <assemble>\n  </assemble>\n</config>";
            zip.folder("Metadata").file("model_settings.config", modelSettingsXml);
            projectSettingsXml = JSON.stringify({
                "name": "project_settings",
                "version": "01.09.01.66",
                "default_print_profile": "0.20mm Standard @BBL A1",
                "printer_model": "Bambu Lab A1",
                "printer_settings_id": "Bambu Lab A1 0.4 nozzle",
                "printer_variant": "0.4",
                "filament_colour": [
                    "#C2C2C2FF"
                ],
                "filament_map": [
                    "1"
                ]
            }, null, 2);
            zip.folder("Metadata").file("project_settings.config", projectSettingsXml);
            sliceInfoXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<config>\n  <header>\n    <header_item key=\"X-BBL-Client-Type\" value=\"slicer\"/>\n    <header_item key=\"X-BBL-Client-Version\" value=\"1.9.1.66\"/>\n  </header>\n</config>";
            zip.folder("Metadata").file("slice_info.config", sliceInfoXml);
            relsXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\n  <Relationship Target=\"/3D/3dmodel.model\" Id=\"rel-1\" Type=\"http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel\"/>\n</Relationships>";
            zip.folder("_rels").file(".rels", relsXml);
            modelRelsXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\n  <Relationship Target=\"/3D/Objects/object_1.model\" Id=\"rel-1\" Type=\"http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel\"/>\n</Relationships>";
            zip.folder("3D").folder("_rels").file("3dmodel.model.rels", modelRelsXml);
            contentTypesXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">\n <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>\n <Default Extension=\"model\" ContentType=\"application/vnd.ms-package.3dmanufacturing-3dmodel+xml\"/>\n <Default Extension=\"png\" ContentType=\"image/png\"/>\n <Default Extension=\"gcode\" ContentType=\"text/x.gcode\"/>\n <Default Extension=\"config\" ContentType=\"text/xml\"/>\n</Types>";
            zip.file("[Content_Types].xml", contentTypesXml);
            return [2 /*return*/, zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } })];
        });
    });
}
