import { readdirSync, readFileSync } from "node:fs";
import { type CompileOptions, D2 } from "@terrastruct/d2";
import type { Element, ElementContent, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import svgToDataURI from "mini-svg-data-uri";
import { optimize, type Config as SvgoConfig } from "svgo";
import type { Plugin } from "unified";
import { visitParents } from "unist-util-visit-parents";
import "./d2.d.ts";

const strategies = ["inline-svg", "inline-png"] as const;
type Strategy = (typeof strategies)[number];

const svggoConfig: SvgoConfig = {};

interface FoundNode {
	node: Element;
	ancestor: Element;
	value: string;
}

function isValidStrategy(strategy: string): strategy is Strategy {
	return strategies.includes(strategy as Strategy);
}

function validateImports(options: RehypeD2Options, fs: Record<string, string>) {
	const { globalImports } = options;
	if (!globalImports) return;

	for (const [theme, imports] of Object.entries(globalImports)) {
		if (imports.length === 0) return;
		const invalidImports = imports.filter((importName) => {
			if (typeof importName === "string") return fs[importName] === undefined;
			return fs[importName.filename] === undefined;
		});
		if (invalidImports.length > 0) {
			const fsKeys = Object.keys(fs).toSorted();
			throw new RehypeD2RendererError(
				`Invalid imports: ${invalidImports.join(", ")} for theme ${theme}, found files: [${fsKeys.join(", ")}]`,
			);
		}
	}
}

function optimizeSvg(svg: string, config: SvgoConfig) {
	const { data } = optimize(svg, config);
	return data;
}

function isD2Tag(
	node: Element,
	target: NonNullable<RehypeD2Options["target"]>,
) {
	if (node.tagName !== target.tagName) return false;
	if (Array.isArray(node.properties.className)) {
		return node.properties.className.includes(target.className);
	}
}

function valueContainsImports(value: string) {
	// Imports are defined using the ...@filename syntax
	const pattern = /^\s*...@\w+(?:\.d2)?\s*$/gm;
	return pattern.test(value);
}

function buildImportDirectory(cwd: string | undefined) {
	if (!cwd) return {};
	const imports = readdirSync(cwd);
	return imports.reduce(
		(acc, importName) => {
			if (!importName.endsWith(".d2")) return acc;
			const importPath = `${cwd}/${importName}`;
			const importContent = readFileSync(importPath, "utf-8");
			acc[importName] = importContent;
			return acc;
		},
		{} as Record<string, string>,
	);
}

function buildHeaders(
	options: RehypeD2Options,
	theme: string,
	fs: Record<string, string>,
) {
	if (!options.globalImports) return "";
	if (!options.globalImports[theme]) return "";
	const r = options.globalImports[theme]
		.map((importName) => {
			if (typeof importName === "string") {
				const withoutSuffix = importName.replace(/\.d2$/, "");
				return `...@${withoutSuffix}`;
			}
			if (importName.mode === "import") {
				const withoutSuffix = importName.filename.replace(/\.d2$/, "");
				return `...@${withoutSuffix}`;
			}
			return fs[importName.filename];
		})
		.filter(Boolean)
		.join("\n");
	return `${r}\n`;
}

function autoCastValue(value: unknown) {
	const valueAsNumber = Number(value);
	if (!Number.isNaN(valueAsNumber)) {
		return valueAsNumber;
	}
	if (value === "true" || value === "false") {
		return value === "true";
	}
	return value;
}

function parseMetadata(node: Element, value: string) {
	const metadata: Record<string, unknown> = {
		title: value.trim(),
		alt: value.trim(),
		noXMLTag: true,
		center: true,
		pad: 0,
		optimize: true,
	};

	const data = node.data as unknown as { meta: string };
	if (data?.meta) {
		// When using markdown, metadata are stored in data.meta using the syntax `key="value"`, e.g. `width="200" title="Diagram title"` (note the quotes)
		const pattern = /([^=\s]+)=(?:"([^"]*)"|([^\s]*))/g;
		let match: RegExpMatchArray | null;
		while (true) {
			match = pattern.exec(data.meta);
			if (!match) break;
			const key = match[1];
			const value = match[2] !== undefined ? match[2] : match[3];
			if (!key || !value) continue;
			metadata[key] = autoCastValue(value);
		}
	}

	if (node.properties) {
		for (const [key, value] of Object.entries(node.properties)) {
			if (Array.isArray(value)) continue;
			metadata[key] = autoCastValue(value);
		}
	}

	// themes is a special case, we expect an array
	if (!Array.isArray(metadata.themes) && typeof metadata.themes === "string") {
		metadata.themes = metadata.themes.split(",");
	}

	return metadata;
}

function addDefaultMetadata(
	to: Record<string, unknown>,
	value: string,
	theme: string,
	defaultMetadata: RehypeD2Options["defaultMetadata"],
) {
	if (!defaultMetadata?.[theme]) return;
	for (const [key, defaultValue] of Object.entries(defaultMetadata[theme])) {
		if (to[key]) continue;
		if (typeof defaultValue === "function") {
			to[key] = defaultValue(value);
		} else {
			to[key] = defaultValue;
		}
	}
}

type Themes = readonly [string, ...string[]];

export type RehypeD2Options<T extends Themes = Themes> = {
	strategy?: Strategy;
	cwd?: string;
	target?: {
		tagName: string;
		className: string;
	};
	defaultThemes?: T;
	defaultMetadata?: Record<
		T[number],
		{
			[k in keyof NodeMetadata]?:
				| NodeMetadata[k]
				| ((value: string) => NodeMetadata[k]);
		}
	>;
	globalImports?: Record<
		T[number],
		Array<
			| `${string}.d2`
			| {
					filename: `${string}.d2`;
					mode: "prepend" | "import";
			  }
		>
	>;
};

export interface NodeMetadata
	extends Omit<CompileOptions, `font${string}` | "target" | "darkThemeId"> {
	title?: string;
	alt?: string;
	width?: string;
	height?: string;
	optimize?: boolean;
}

export class RehypeD2RendererError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RehypeD2RendererError";
	}
}

const rehypeD2: Plugin<[RehypeD2Options], Root> = (
	options: RehypeD2Options,
) => {
	const {
		strategy = "inline-svg",
		target = {
			tagName: "code",
			className: "language-d2",
		},
		cwd,
		defaultMetadata,
		globalImports,
		defaultThemes = ["default"],
	} = options;

	if (!isValidStrategy(strategy)) {
		throw new RehypeD2RendererError(
			`Invalid strategy "${strategy}". Valid strategies are: ${strategies.join(
				", ",
			)}`,
		);
	}
	if (
		globalImports &&
		Object.values(globalImports).some((imports) => imports.length > 0) &&
		!cwd
	) {
		throw new RehypeD2RendererError(
			`To use globalImports, you must provide a "cwd" option (directory to resolve imports from)`,
		);
	}

	const fs = buildImportDirectory(cwd);
	validateImports(options, fs);

	return async (tree) => {
		const foundNodes: FoundNode[] = [];

		visitParents(tree, "element", (node, ancestors) => {
			if (!isD2Tag(node, target) || node.children.length === 0) {
				return;
			}
			if (node.children.length !== 1) {
				throw new RehypeD2RendererError(
					`Expected exactly one child element for ${node.tagName} elements, but found ${node.children.length}`,
				);
			}

			const nodeContent = node.children[0] as { value: string };

			if (valueContainsImports(nodeContent.value) && !cwd) {
				throw new RehypeD2RendererError(
					`To use imports, you must provide a "cwd" option (directory to resolve imports from)`,
				);
			}

			// biome-ignore lint/style/noNonNullAssertion: Element is not the root so it has a parent
			const parent = ancestors.at(-1)!;
			foundNodes.push({
				node,
				value: nodeContent.value,
				ancestor: parent as Element,
			});
		});

		await Promise.all(
			foundNodes.map(async ({ node, value, ancestor }) => {
				const d2 = new D2();
				const baseMetadata = parseMetadata(node, value);
				if (!baseMetadata.themes) {
					baseMetadata.themes = defaultThemes;
					if (defaultThemes.length === 0) {
						throw new RehypeD2RendererError(
							"Missing themes in metadata and no defaultThemes found",
						);
					}
				}

				const metadataThemes = new Set(baseMetadata.themes as string[]);
				const elements: Element[] = [];

				for (const theme of metadataThemes) {
					const headers = buildHeaders(options, theme, fs);
					const metadata = JSON.parse(JSON.stringify(baseMetadata));
					addDefaultMetadata(metadata, value, theme, defaultMetadata);

					// Add theme to metadata salt so the diagram ID is unique
					metadata.salt = theme;

					const codeToProcess = `${headers}${value}`;
					const render = await d2.compile({
						fs: {
							...fs,
							index: codeToProcess,
						},
						options: metadata,
					});

					const svg = await d2.render(render.diagram, render.renderOptions);
					if (typeof svg !== "string") {
						throw new RehypeD2RendererError(
							`Failed to render svg diagram for ${value}`,
						);
					}
					let optimizedSvg: string = svg;
					if (metadata.optimize) {
						optimizedSvg = optimizeSvg(svg, svggoConfig);
					}

					const sharedProperties = {
						height: metadata.height as number,
						width: metadata.width as number,
						"data-d2-theme": theme,
						title: metadata.title as string,
					};

					let result: ElementContent;
					if (strategy === "inline-svg") {
						const root = fromHtml(optimizedSvg, {
							fragment: true,
						}) as unknown as Root;
						// biome-ignore lint/style/noNonNullAssertion: There is a root element
						const svgElement = root.children![0] as Element;
						svgElement.properties = {
							...svgElement.properties,
							...sharedProperties,
							role: "img",
							"aria-label": metadata.alt as string,
						};
						result = svgElement;
					} else {
						const img: Element = {
							type: "element",
							tagName: "img",
							properties: {
								...sharedProperties,
								alt: metadata.alt as string,
								src: svgToDataURI(optimizedSvg),
							},
							children: [],
						};
						result = img;
					}
					elements.push(result);
				}

				// biome-ignore lint/style/noNonNullAssertion: Element is not the root so it has a parent
				const children = ancestor.children!;
				const index = children.indexOf(node);
				children.splice(index, 1, ...elements);
			}),
		);
	};
};

export default rehypeD2;
