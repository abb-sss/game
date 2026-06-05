import tseslint from "typescript-eslint";

/** AIGF 模板 ESLint — 禁止硬编码资源路径 */
export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/assets\\/(sprites|audio|anims)\\//]",
          message:
            "禁止硬编码资源路径，请使用 manifest id 作为 Phaser 纹理/音频 key",
        },
        {
          selector: "Literal[value=/\\.png$|\\.ogg$|\\.wav$/]",
          message: "禁止硬编码资源文件名，请使用 manifest id",
        },
      ],
    },
  },
);
