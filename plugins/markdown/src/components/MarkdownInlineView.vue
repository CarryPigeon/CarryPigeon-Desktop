<script lang="ts">
// 行内节点渲染组件：递归渲染文本/加粗/斜体/代码/链接，全部走文本节点，绝不 innerHTML。
import { defineComponent, h, type PropType, type VNode } from "vue";
import type { MarkdownInlineNode } from "../domain/markdownParser";

const MarkdownInlineView = defineComponent({
  name: "MarkdownInlineView",
  props: {
    nodes: { type: Array as PropType<MarkdownInlineNode[]>, required: true },
  },
  setup(props) {
    const renderNodes = (nodes: MarkdownInlineNode[]): (VNode | null)[] =>
      nodes.map((node, index) => {
        switch (node.type) {
          case "text":
            return h("span", { key: index }, node.text);
          case "code":
            return h("code", { key: index, class: "cp-md-inline-code" }, node.text);
          case "bold":
            return h("strong", { key: index }, renderNodes(node.children));
          case "italic":
            return h("em", { key: index }, renderNodes(node.children));
          case "link":
            // url 已在解析器层限定为 http(s)。
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
    return () => h("span", { class: "cp-md-inline" }, renderNodes(props.nodes));
  },
});

export default MarkdownInlineView;
</script>
