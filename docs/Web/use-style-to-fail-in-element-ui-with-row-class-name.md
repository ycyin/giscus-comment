---
title: 关于Vue中使用Element-UI样式row-class-name失效的问题
tags:
  - Element-UI
  - el-table
keywords:
  - Element-UI
  - el-table
  - row-class-name
  - row-style
  - cell-class-name
  - css 失效
date: 2020-07-06 14:50:10
categories: Vue
description: Vue项目中，需要给el-table表格中的每一行加入自定义的样式，根据文档给组件加上row-class-name属性即可，直接加入该属性并且在当前Vue组件中配置对应class的样式发现并没有生效。
---
## 问题描述

Vue项目中，需要给el-table表格中的每一行加入自定义的样式，根据文档给组件加上row-class-name属性即可，直接加入该属性并且在当前Vue组件中配置对应class的样式发现并没有生效。官方文档地址： https://element.eleme.cn/#/zh-CN/component/table 

在Element-UI中，row-class-name、row-style、cell-class-name等属性设置的css样式必须使用全局style样式才能生效。

## 解决方案

### 1、使用全局属性

因为之前的代码都是在组件中编写的，所以去除style标签中的scoped即可将该组件中的样式变为全局属性。当然这样做有个缺陷，很容易引起因为样式重复定义导致意外错误，所以更推荐第二种解决方案。 

### 2、使用混合样式（推荐）

混合样式很容易理解，就是同时使用全局属性与局部属性。尝试过在组件中定义两个style标签块，但是报错了，vue不支持这种写法。

最佳解决方案，组件中使用scoped限定样式作用域，需要用到全局属性时在script标签中使用@import语法引用进来，示例代码如下：

```vue
<template>
    <el-table
      :row-class-name="getRowClass"
    >
    </el-table>
  </div>
</template>
<script>
// 引入全局样式表    
import '@/styles/el-table-row-expand.scss'

export default {
  methods: {
    // 对应class-name的样式设置在@/styles/el-table-row-expand.scss中
    getRowClass(row, rowIndex) {
      // 根据自己的业务逻辑返回class-name
    }
  }
}
</script>
<style scoped>
/*局部样式写在这里即可*/
</style>
```

