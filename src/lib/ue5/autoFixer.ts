export function autoFixUE5Code(code: string): { valid: boolean; errors: string[]; fixedCode: string } {
  let fixedCode = code;
  const errors: string[] = [];

  if (code.includes("unreal.load_object")) {
    fixedCode = fixedCode.replace(
      /unreal\.load_object\s*\(\s*None\s*,\s*'([^']+)'\s*\)/g,
      "unreal.EditorAssetLibrary.load_asset('$1')"
    );
    errors.push("Fixed: Replaced load_object with EditorAssetLibrary.load_asset");
  }

  if (code.includes("EditorLevelLibrary()")) {
    fixedCode = fixedCode.replace(/EditorLevelLibrary\(\)/g, "EditorLevelLibrary");
    errors.push("Fixed: Removed parentheses from EditorLevelLibrary");
  }

  if (code.includes(".get_light_component()")) {
    fixedCode = fixedCode.replace(
      /\.get_light_component\(\)/g,
      ".get_component_by_class(unreal.LightComponent)"
    );
    errors.push("Fixed: Replaced get_light_component with get_component_by_class");
  }

  if (code.includes(".get_static_mesh_component()")) {
    fixedCode = fixedCode.replace(
      /\.get_static_mesh_component\(\)/g,
      ".get_component_by_class(unreal.StaticMeshComponent)"
    );
    errors.push("Fixed: Replaced get_static_mesh_component with get_component_by_class");
  }

  if (code.includes("set_static_mesh(unreal.load_object")) {
    fixedCode = fixedCode.replace(
      /set_static_mesh\(unreal\.load_object\(None,\s*'([^']+)'\)\)/g,
      "set_static_mesh(unreal.EditorAssetLibrary.load_asset('$1'))"
    );
    errors.push("Fixed: Replaced load_object in set_static_mesh");
  }

  if (code.includes("/Game/")) {
    fixedCode = fixedCode.replace(/.*\/Game\/(?!Maps).*material.*\n?/gi, "");
    fixedCode = fixedCode.replace(/.*set_material.*\/Game\/.*\n?/gi, "");
    errors.push("Fixed: Removed invalid /Game/ material references");
  }

  if (!code.includes("unreal.log")) {
    fixedCode += "\nunreal.log('Code executed successfully')";
    errors.push("Fixed: Added unreal.log confirmation");
  }

  const validPaths = [
    "/Engine/BasicShapes/Cube",
    "/Engine/BasicShapes/Sphere",
    "/Engine/BasicShapes/Cylinder",
    "/Engine/BasicShapes/Cone",
    "/Engine/BasicShapes/Plane",
  ];
  const meshPathRegex = /load_asset\(['"]([^'"]+)['"]\)/g;
  let match: RegExpExecArray | null;
  while ((match = meshPathRegex.exec(fixedCode)) !== null) {
    if (!validPaths.includes(match[1]) && !match[1].startsWith("/Engine/")) {
      errors.push(`Warning: Unknown mesh path ${match[1]} - may not exist`);
    }
  }

  return { valid: errors.length === 0, errors, fixedCode };
}
