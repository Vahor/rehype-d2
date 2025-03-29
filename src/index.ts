// @ts-expect-error: types are not available
import { D2, type RenderOptions } from "@terrastruct/d2";
import type { Element, ElementContent, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import svgToDataURI from "mini-svg-data-uri";
import type { Plugin } from "unified";
import { visitParents } from "unist-util-visit-parents";

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

function getRenderAlt(renderOptions: RenderOptions, value: string) {
	if (typeof renderOptions.alt === "function") {
		return renderOptions.alt(value);
	}
	return renderOptions.alt || "D2 diagram";
}

function getRenderTitle(renderOptions: RenderOptions, value: string) {
	if (typeof renderOptions.title === "function") {
		return renderOptions.title(value);
	}
	return renderOptions.title || value.trim();
}

export interface RehypeD2Options {
	strategy?: Strategy;
	target?: {
		tagName: string;
		className: string;
	};
	renderOptions?: RenderOptions & {
		alt?: string | ((value: string) => string);
		title?: string | ((value: string) => string);
	};
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
		renderOptions = {},
	} = options || {};

	if (!isValidStrategy(strategy)) {
		throw new RehypeD2RendererError(
			`Invalid strategy "${strategy}". Valid strategies are: ${strategies.join(
				", ",
			)}`,
		);
	}

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
				const render = await d2.compile(value, renderOptions);
				const svg = await d2.render(render.diagram, render.renderOptions);
				if (typeof svg !== "string") {
					throw new RehypeD2RendererError(
						`Failed to render svg diagram for ${value}`,
					);
				}

				let result: ElementContent;
				if (strategy === "inline-svg") {
					result = fromHtml(svg, {
						fragment: true,
					}) as unknown as ElementContent;
				} else {
					const img: Element = {
						type: "element",
						tagName: "img",
						properties: {
							alt: getRenderAlt(renderOptions, value),
							src: svgToDataURI(svg),
							title: getRenderTitle(renderOptions, value),
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
