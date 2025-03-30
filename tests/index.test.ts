import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { rehype } from "rehype";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { VFile } from "vfile";
import rehypeD2, { type RehypeD2Options } from "../src/index.ts";

describe("types", () => {
	test("fails if strategy is invalid", () => {
		// @ts-expect-error: we are testing invalid values
		const processor = rehype().use(rehypeD2, { strategy: "invalid" });

		expect(() => processor.processSync("")).toThrowErrorMatchingSnapshot();
	});
	test("fails if cwd is not provided when using imports", () => {
		const processor = rehype().use(rehypeD2, {
			strategy: "inline-svg",
		});

		const vFile = new VFile({
			path: "test.html",
			value: '<code class="language-d2">\n...@vars\n</code>',
		});

		expect(
			async () => await processor.process(vFile),
		).toThrowErrorMatchingSnapshot();
	});

	test("fails if using globalImports without cwd", () => {
		const processor = rehype().use(rehypeD2, {
			strategy: "inline-svg",
			globalImports: {
				b: ["vars.d2"],
			},
		});

		const vFile = new VFile({
			path: "test.html",
			value: '<code class="language-d2">\n...@vars\n</code>',
		});

		expect(
			async () => await processor.process(vFile),
		).toThrowErrorMatchingSnapshot();
	});

	test("fails if using globalImports with a file that doesn't exist", () => {
		const processor = rehype().use(rehypeD2, {
			strategy: "inline-svg",
			cwd: "tests/imports",
			globalImports: {
				a: ["vars.d2", "invalid.d2"],
			},
		});

		const vFile = new VFile({
			path: "test.html",
			value: '<code class="language-d2">\n...@vars\n</code>',
		});

		expect(
			async () => await processor.process(vFile),
		).toThrowErrorMatchingSnapshot();
	});
});

describe("renders", async () => {
	const fixtures = readdirSync("tests/fixtures");

	const options: RehypeD2Options = {
		cwd: "tests/imports",
		defaultMetadata: {
			a: {
				alt: "custom alt",
			},
			dark: {
				themeID: 200,
			},
		},
		globalImports: {
			a: ["global.d2"],
			dark: ["global.d2"],
		},
	} as const;

	const runTest = async ({
		processor,
		outputFileName,
		fixtureContent,
	}: {
		// biome-ignore lint/suspicious/noExplicitAny: I don't know the correct type
		processor: any;
		outputFileName: string;
		fixtureContent: string;
	}) => {
		const result = await processor.process(fixtureContent);
		expect(result.value).toMatchSnapshot();
		if (process.env.CI !== "true") {
			Bun.write(`tests/output/${outputFileName}`, result.value);
		}
	};

	for (const fixture of fixtures) {
		const fixtureContent = await Bun.file(`tests/fixtures/${fixture}`).text();
		if (fixture.endsWith(".md")) {
			describe(fixture, () => {
				test("renders to inline-svg (markdown)", async () => {
					const processor = unified()
						.use(remarkParse)
						.use(remarkRehype)
						.use(rehypeD2, {
							...options,
							strategy: "inline-svg",
						})
						.use(rehypeStringify);
					await runTest({
						processor,
						outputFileName: `${fixture}-inline-svg.html`,
						fixtureContent,
					});
				});
				test("renders to inline-png (markdown)", async () => {
					const processor = unified()
						.use(remarkParse)
						.use(remarkRehype)
						.use(rehypeD2, {
							...options,
							strategy: "inline-png",
						})
						.use(rehypeStringify);
					await runTest({
						processor,
						outputFileName: `${fixture}-inline-png.html`,
						fixtureContent,
					});
				});
			});
		} else {
			describe(fixture, () => {
				test("renders to inline-svg (html)", async () => {
					const processor = rehype().use(rehypeD2, {
						...options,
						strategy: "inline-svg",
					});
					await runTest({
						processor,
						outputFileName: `${fixture}-inline-svg.html`,
						fixtureContent,
					});
				});
				test("renders to inline-png (html)", async () => {
					const processor = rehype().use(rehypeD2, {
						...options,
						strategy: "inline-png",
					});
					await runTest({
						processor,
						outputFileName: `${fixture}-inline-png.html`,
						fixtureContent,
					});
				});
			});
		}
	}
});
