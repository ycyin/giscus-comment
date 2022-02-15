---
title: 记录Vue中父子组件传值的实战应用
tags:
  - vue
  - props
  - emit
keywords:
  - vue父子组件传值
  - vue自定义组件
date: 2022-02-15 15:47:58
categories: 前端技术
description: Vue项目中，父子组件的传值是比较常用的，这里记录使用方法。
---


## 背景

在vue中只要用到子组件就会涉及到父子组件的传值，以下面这个例子为引导，记录Vue中父子组件的通信传值问题，防遗忘。为了简洁只记录一种最为常用的方式。其它方式可以参考文末的参考文章。

使用[vant](https://vant-contrib.gitee.io/vant/#/zh-CN/)提供的van-popup组件时，默认样式不满足项目需求，需要自定义。我们就对van-popup进行二次封装其中会用到父子组件传值。

## 父组件给子组件传值

在子组件中定义`props`，包含父组件要给子组件传递的属性值名称、类型、默认值等。

```js
export default {
  name: "RadioListPicker",
  props: {
    title:{
      type: String,
      default: null
    },
    columns: {
      type: Array,
      default: null
    },
  },
  data(){
    return {
    }
  },
  methods:{

  },
  watch:{

  }
}
```

当父组件传递过来值后，props中的参数被解析为整个子组件域可用，所以子组件可以直接使用props中的属性即可。

```vue
<div class="radio-picker__title van-ellipsis">{{title}}</div>
```

```vue
<van-cell v-for="item in columns" :key="item.key" :title="item.value" @click="handleClick($event,item.key,item.value)"/>
```

在父组件中使用子组件时传递给它对应的值即可。以下例子

```vue
<RadioPicker  :title="title" :columns="data" ></RadioPicker>
```

这样在父组件中传递给子组件的可变参数title、data子组件使用title、columns可成功接收。

## 子组件给父组件传值

子组件给父组件传值，需要在父组件使用子组件时定义好回调函数(个人理解,可能描述不准确)，在子组件中使用`$emit`触发。通过给这个回调函数传递参数即可达到子组件给父组件传值的目的。

以下示例：

父组件：定义子组件会通过`$emit`触发`handleClick`和`handleClose`

```vue
<RadioPicker @handleClick="onClick" @handleClose="close"></RadioPicker>
```

子组件：通过`$emit`触发`handleClick`和`handleClose`,并可以传值

```js
/**
 * 点击Item事件
 */
handleClick(e, key,value){
  this.$emit('handleClick',{key:key,value:value})
},
/**
 * 弹出层关闭时触发@close
 */
close(){
  this.$emit('handleClose')
}
```

## 完整实例：

**子组件：** 是对vant组件库的`van-popup`组件的进一步封装。添加了顶部toolbar和关闭按钮，底部是一个可以可以点击选择的list列表。

```vue
<template>
  <div>
    <van-popup :show="showPopup" round position="bottom" @close="close">
      <van-row class="radio-picker__toolbar">
        <van-col span="16" offset="4">
          <div class="radio-picker__title van-ellipsis">{{title}}</div>
        </van-col>
        <van-col span="4">
          <button type="button"  class="radio-picker__cancel van-haptics-feedback" @click="cancel">
            <van-icon class-prefix="iconfont icon-blue-close"/>
          </button>
        </van-col>
      </van-row>
      <div class="radio-picker__content" :style="'height:'+height+'px'">
        <van-cell v-for="item in columns" :key="item.key" :title="item.value"
                  @click="handleClick($event,item.key,item.value)"/>
      </div>
    </van-popup>
  </div>
</template>

<script>

export default {
  name: "RadioListPicker",
  props: {
    show: {
      type: Boolean,
      default: false
    },
    height: {
      type: Number,
      default: 300
    },
    title:{
      type: String,
      default: null
    },
    columns: {
      type: Array,
      default: null
    },
  },
  data(){
    return {
      showPopup: this.show
    }
  },
  methods:{
    /**
     * 点击Item事件
     */
    handleClick(e, key,value){
      this.$emit('handleClick',{key:key,value:value})
    },
    /**
     * 右上角×点击关闭
     */
    cancel(){
      this.showPopup = false;
    },
    /**
     * 弹出层关闭时触发@close
     */
    close(){
      this.$emit('handleClose')
    }
  },
  watch:{
    /**
     * watch props参数show,及时响应显示与关闭
     */
    show(){
      this.showPopup = this.show
    },

  }
}
</script>

<style lang="less" scoped>
@import "../../less/color";

  .radio-picker__toolbar{
    align-items: center;
    height: 51px;
    background-color: @bgGrayLightColor;

    .radio-picker__cancel{
      height: 100%;
      padding: var(--van-padding-md);
      font-size: var(--van-font-size-md);
      background-color: transparent;
      border: none;
      color: @textBlueColor;
      font-size: 14px;
    }

    .radio-picker__title {
      max-width: 100%;
      font-size: 16px;
      line-height: 51px;
      font-family: @fontFamilyBold;
      font-weight: 600;
      color: @textBlackColor;
    }
  }

  .radio-picker__content{
    height: 300px;
    overflow-y: auto;

    :deep(.van-cell__title){
      font-size:14px;
      font-family: @fontFamilyRegular;
      font-weight: 400;
      color: @textBlackDeepColor;
    }
  }

</style>
```

**父组件：** 使用子组件，给子组件传值、接收子组件选择的值。

```vue
<template>
  <div class="home">
    <button class="btns" @click="this.showPicker = true">显示单个Picker</button>
    <RadioPicker :show="showPicker" :title="title" :columns="data" :height="300"
                 @handleClick="onClick" @handleClose="close"></RadioPicker>
  </div>
</template>

<script>
import RadioPicker from '../components/common/RadioListPicker.vue'

export default {
  name: 'Home',
  data() {
    return {
      showPicker:false,
      title:"请选择",
      data:[
        {key:1,value:'xxx'}, {key:2,value:'xx'}, {key:10,value:'xxxxxx'},
        {key:14,value:'xxx'}, {key:15,value:'xxxxx'}, {key:16,value:'xxx'},
        {key:4,value:'xxx'},{key:20,value:'xxxxxx'},{key:26,value:'xxxxxxxxxxx'},{key:3,value:'xx'}]
    }
  },
  components: {RadioPicker},
  methods: {
    /**
     * @handleClick处理列表点击事件
     * @param key
     * @param value
     */
    onClick({key,value}){
      this.showPicker = false;
      console.log("父组件接收到值")
      console.log(key,value)
    },
    /**
     * @handleClose处理关闭事件
     */
    close() {
      this.showPicker = false;
    }
  }
}

</script>
```

## 参考：

[Popup 弹出层 - Vant 3 (gitee.io)](https://vant-contrib.gitee.io/vant/#/zh-CN/popup)

[单文件组件 | Vue.js (vuejs.org)](https://v3.cn.vuejs.org/guide/single-file-component.html#介绍)

[应用 & 组件实例 | Vue.js (vuejs.org)](https://v3.cn.vuejs.org/guide/instance.html#生命周期图示)

[实例方法 | Vue.js (vuejs.org)](https://v3.cn.vuejs.org/api/instance-methods.html#emit)

[Vue 自定义组件 - 简书 (jianshu.com)](https://www.jianshu.com/p/99f490b76b03)

[vant组件slot使用，vue实现单选多选_qq_42301244的博客-CSDN博客_v-slot:search](https://blog.csdn.net/qq_42301244/article/details/109286533)

[vant-picker实现自定义内容，根据内容添加图标_Ponnenult的博客-CSDN博客_vant-picker](https://blog.csdn.net/weixin_44727080/article/details/108716054)



