import { defineClientConfig } from 'vuepress/client'
import { onMounted} from 'vue'
import { SpeedInsights } from '@vercel/speed-insights/vue';
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
    })
  },
  rootComponents: [SpeedInsights],
})
