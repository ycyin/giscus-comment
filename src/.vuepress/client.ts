import { defineClientConfig } from 'vuepress/client'
import { onMounted} from 'vue'
import { SpeedInsights } from '@vercel/speed-insights/vue';
import { inject } from '@vercel/analytics';
// 客户端配置文件
// https://theme-hope.vuejs.press/zh/cookbook/vuepress/config.html#%E5%AE%A2%E6%88%B7%E7%AB%AF%E9%85%8D%E7%BD%AE%E6%96%87%E4%BB%B6
// https://vuejs.press/zh/advanced/cookbook/usage-of-client-config.html
export default defineClientConfig({
  enhance({ app, router, siteData }) {},
  setup() {
    // 组合式API调用
    // https://vuejs.press/zh/advanced/cookbook/usage-of-client-config.html#%E4%BD%BF%E7%94%A8%E7%BB%84%E5%90%88%E5%BC%8F-api
    // console.log('client setup')
    onMounted(() => {
        // console.log('client mounted')
        // 开启vercel/analytics,可能导致页面加载失败，报错ERR_BLOCKED_BY_CLIENT，多半是浏览器插件导致的，详见https://www.keycdn.com/support/how-to-solve-err-blocked-by-client
        console.info('加载vercel/analytics....,如果失败请尝试更换浏览器或将当前域名添加到Adguard或AdBlock的白名单')
        inject()
    })
  },
  rootComponents: [SpeedInsights],
})
