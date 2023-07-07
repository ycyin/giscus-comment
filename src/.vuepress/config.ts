import { defineUserConfig } from "vuepress";
import { searchProPlugin } from "vuepress-plugin-search-pro";
import { redirectPlugin } from "vuepress-plugin-redirect";
import theme from "./theme.js";

export default defineUserConfig({
  base: "/",
  // 移动端优化
  head: [
    ['meta', { name: 'viewport', content: 'width=device-width,initial-scale=1,user-scalable=no' }],
    ['meta', { name: "google-site-verification", content: "NL5qmCT5yDHkyrRJUGxdC-9yeoSzCGXptwYUFziA64s" }],
    ['link', { rel: 'icon', href: '/img/avatar/bitbug_favicon32.ico' }], //favicon图标设置
  ],
  title: '敲代码的小松鼠',
  locales: {
    "/": {
      lang: "zh-CN",
      title: "敲代码的小松鼠",
      description: "敲代码的小松鼠,ycyin的博客,小松鼠的博客",
    },
  },
  plugins: [
    searchProPlugin({
      // 索引全部内容
      indexContent: true,
    }),
    redirectPlugin({
      // 重定向配置
      config: (app) =>{
        // 如果是/posts/开头的页面就设置一条规则[/a,/posts/a],表示访问/a时重定向到/posts/a
        const redirects  = app.pages
        .filter(({ path }) => path.startsWith("/posts/"))
        .map(({ path }) => [path.replace(/^\/posts\//, "/"), path]);
        // console.log(redirects)
        return Object.fromEntries(
          redirects
        )
      },
    }),
  ],

  theme,

  // Enable it with pwa
  shouldPrefetch: false,
});
