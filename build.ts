import type { BuildConfig } from "bun";
import dts, { type Options as DtsOptions } from "bun-plugin-dts";

const defaultBuildConfig: BuildConfig = {
	target: "node",
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	packages: "external",
};

const dtsConfig: DtsOptions = {
	output: {
		noBanner: true,
	},
};

const addImportHeader = async (file: string) => {
	const content = await Bun.file(file).text();
	return `
import "./d2.d.ts";
${content}
`;
};

await Promise.all([
	Bun.build({
		...defaultBuildConfig,
		plugins: [dts(dtsConfig)],
		format: "esm",
		naming: "[dir]/[name].js",
	}),
	Bun.build({
		...defaultBuildConfig,
		format: "cjs",
		naming: "[dir]/[name].cjs",
	}),
	Bun.write("dist/d2.d.ts", Bun.file("./src/d2.d.ts")),
	Bun.write("dist/index.d.ts", await addImportHeader("./dist/index.d.ts")),
]);
