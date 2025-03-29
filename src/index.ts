import { readFileSync, readdirSync } from "node:fs";
import { type CompileOptions, D2 } from "@terrastruct/d2";
import type { Element, ElementContent, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import svgToDataURI from "mini-svg-data-uri";
import type { Plugin } from "unified";
import { visitParents } from "unist-util-visit-parents";
import "./d2.d.ts";

const strategies = ["inline-svg", "inline-png"] as const;
type Strategy = (typeof strategies)[number];

interface FoundNode {
	node: Element;
	ancestor: Element;
	value: string;
}

function isValidStrategy(strategy: string): strategy is Strategy {
	return strategies.includes(strategy as Strategy);
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
	const pattern = /^\s*...@\w+\s*$/gm;
	return pattern.test(value);
}

function buildImportDirectory(cwd: string | undefined) {
	if (!cwd) return {};
	const imports = readdirSync(cwd);
	return imports.reduce(
		(acc, importName) => {
			const importPath = `${cwd}/${importName}`;
			const importContent = readFileSync(importPath, "utf-8");
			acc[importName] = importContent;
			return acc;
		},
		{} as Record<string, string>,
	);
}

function parseMetadata(
	node: Element,
	value: string,
	defaultMetadata: RehypeD2Options["defaultMetadata"],
) {
	const metadata: Record<string, unknown> = {};
	if (defaultMetadata) {
		for (const [key, defaultValue] of Object.entries(defaultMetadata)) {
			if (typeof defaultValue === "function") {
				metadata[key] = defaultValue(value);
			} else {
				metadata[key] = defaultValue;
			}
		}
	}
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
			const valueAsNumber = Number(value);
			if (!Number.isNaN(valueAsNumber)) {
				metadata[key] = valueAsNumber;
			} else {
				if (value === "true" || value === "false") {
					metadata[key] = value === "true";
				} else {
					metadata[key] = value;
				}
			}
		}
	}

	if (node.properties) {
		for (const [key, value] of Object.entries(node.properties)) {
			if (Array.isArray(value)) continue;
			metadata[key] = value;
		}
	}
	return metadata;
}

export interface RehypeD2Options {
	strategy?: Strategy;
	cwd?: string;
	target?: {
		tagName: string;
		className: string;
	};
	defaultMetadata?: {
		[k in keyof NodeMetadata]?:
			| NodeMetadata[k]
			| ((value: string) => NodeMetadata[k]);
	};
}

export interface NodeMetadata
	extends Omit<CompileOptions, `font${string}` | "target"> {
	title?: string;
	alt?: string;
	width?: string;
	height?: string;
}

export class RehypeD2RendererError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RehypeD2RendererError";
	}
}

const rehypeD2: Plugin<[RehypeD2Options], Root> = (options) => {
	const {
		strategy = "inline-svg",
		target = {
			tagName: "code",
			className: "language-d2",
		},
		cwd,
		defaultMetadata = {
			title: (value: string) => value.trim(),
			alt: (value: string) => value.trim(),
			noXMLTag: true,
			center: true,
			pad: 0,
		},
	} = options || {};

	if (!isValidStrategy(strategy)) {
		throw new RehypeD2RendererError(
			`Invalid strategy "${strategy}". Valid strategies are: ${strategies.join(
				", ",
			)}`,
		);
	}

	const fs = buildImportDirectory(cwd);

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
				const metadata = parseMetadata(node, value, defaultMetadata);
				const render = await d2.compile({
					fs: {
						...fs,
						index: value,
					},
					options: metadata,
				});
				const svg = await d2.render(render.diagram, render.renderOptions);
				if (typeof svg !== "string") {
					throw new RehypeD2RendererError(
						`Failed to render svg diagram for ${value}`,
					);
				}

				let result: ElementContent;
				if (strategy === "inline-svg") {
					const root = fromHtml(svg, {
						fragment: true,
					}) as unknown as Root;
					// biome-ignore lint/style/noNonNullAssertion: There is a root element
					const svgElement = root.children![0] as Element;
					svgElement.properties = {
						...svgElement.properties,
						width: metadata.width as number,
						height: metadata.height as number,
						title: metadata.title as string,
						alt: metadata.alt as string,
					};
					result = svgElement;
				} else {
					const img: Element = {
						type: "element",
						tagName: "img",
						properties: {
							alt: metadata.alt as string,
							src: svgToDataURI(svg),
							title: metadata.title as string,
							width: metadata.width as number,
							height: metadata.height as number,
						},
						children: [],
					};
					result = img;
				}

				// biome-ignore lint/style/noNonNullAssertion: Element is not the root so it has a parent
				const children = ancestor.children!;
				const index = children.indexOf(node);
				children.splice(index, 1, result);
			}),
		);
	};
};

export default rehypeD2;
