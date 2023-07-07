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
      // 重定向配置,为了不让之前收录到Google的访问是404链接
      config: (app) =>{
        // 如果是/posts/开头的页面就设置一条规则[访问url,重定向到url]
        // [/Spring,/posts/Spring],表示访问/Spring 时重定向到/posts/Spring
        // [/云原生,/posts/云原生],表示访问/云原生 时重定向到/posts/云原生
        const redirects  = app.pages
        .filter(({ path }) => path.startsWith("/posts/"))
        .map(({ path }) => [
          path.replace(/^\/posts\//, "/")
          .replace('/Frontend/',"/前端技术/")
          .replace('/Database/','/数据库技术/')
          .replace('/CloudNative/','/云原生/')
          .replace('/Software/','/软件安装&配置/')
          .replace('/DesignPatterns/','/设计模式/')
          .replace('/WebAndSecurity/','/安全&设计/')
          .replace('/Concurrent/','/多线程/')
          .replace('/Commands/','/常用命令/')
          .replace('/Algorithms/','/算法&数学/'), path]);
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
