<script lang="ts">
// markdown 消息渲染器：解析为渲染树后用 vnode 渲染，所有文本走文本节点，绝不 innerHTML。
import { defineComponent, h, type PropType, type VNode } from "vue";
import {
  parseMarkdown,
  type MarkdownBlockNode,
  type MarkdownInlineNode,
} from "../domain/markdownParser";

/** 递归渲染行内节点：link 仅允许解析器放行的 http(s) url。 */
function renderInlineNodes(nodes: MarkdownInlineNode[]): (VNode | null)[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return h("span", { key: index }, node.text);
      case "code":
        return h("code", { key: index, class: "cp-md-inline-code" }, node.text);
      case "bold":
        return h("strong", { key: index }, renderInlineNodes(node.children));
      case "italic":
        return h("em", { key: index }, renderInlineNodes(node.children));
      case "link":
        return h(
          "a",
          {
            key: index,
            class: "cp-md-link",
            href: node.url,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          node.text,
        );
      default:
        return null;
    }
  });
}

/** 渲染块节点。 */
function renderBlock(block: MarkdownBlockNode, key: number): VNode {
  switch (block.type) {
    case "heading": {
      const tag = `h${block.level + 2}` as "h3" | "h4" | "h5";
      return h(tag, { key, class: "cp-md-heading" }, renderInlineNodes(block.children));
    }
    case "codeBlock":
      return h("pre", { key, class: "cp-md-code-block" }, [
        h("code", null, block.text),
      ]);
    case "list": {
      const tag = block.ordered ? "ol" : "ul";
      return h(
        tag,
        { key, class: "cp-md-list" },
        block.items.map((item, i) => h("li", { key: i }, renderInlineNodes(item))),
      );
    }
    case "paragraph":
    default:
      return h("p", { key, class: "cp-md-paragraph" }, renderInlineNodes(block.children));
  }
}

const MarkdownMessage = defineComponent({
  name: "MarkdownMessage",
  props: {
    // 与宿主 renderer 契约一致：data 为消息 domain 数据（{ text: string }）。
    data: { type: null as unknown as PropType<{ text?: string } | null>, required: false, default: null },
    preview: { type: String, required: false, default: "" },
  },
  setup(props) {
    return () => {
      // 兼容 data 缺失时退回 preview 纯文本。
      const raw = typeof props.data?.text === "string" ? props.data.text : props.preview || "";
      const blocks = parseMarkdown(raw);
      return h("div", { class: "cp-md-message" }, blocks.map((b, i) => renderBlock(b, i)));
    };
  },
});

export default MarkdownMessage;
</script>
