---
title: Element-UI中实现可动态增加行列和可编辑单元格的表格
tags:
  - Vue
  - AHP
  - Element-UI
  - el-table
  - 动态表格
keywords:
  - 表格动态增加行列
  - 可编辑表格
  - Element-UI
  - el-table
date: 2020-06-27 00:09:11
categories: Vue
description: 使用Vue+Element-UI的Table组件实现动态增加行列、可编辑的表格。并实现右上三角单元格为灰色不可编辑。
---
### 前言

> 基本需求场景：使用层次分析法（AHP）时，需要前端实现一个可动态添加表格行列、且单元格可编辑的表格。关于层次分析法可查看另一篇博客：[层次分析法（AHP）分析步骤与计算方法]( https://ladybug.top/AHP-base/ )

使用到的技术主要是`vue`和`element-ui`，`element-ui`官方文档：https://element.eleme.cn/#/zh-CN/component/table  中`el-table`组件不支持动态增加列，增加行则可以通过增加数据行实现，并且并不支持单元格的编辑，唯一可用到的就是可以监听单元格的双击/单击事件。

### 实现效果

可访问CodePen在线查看代码和效果展示：[https://codepen.io/yyc007/pen/abdyNeb](https://codepen.io/yyc007/pen/abdyNeb)

<img :src="$withBase('/Web/dynamic-add-rows-columns-and-editable-table-in-element-ui/1593181815033.png')" alt="效果展示">

### 基本思路

**动态增加行列：** 动态增加行可以巧妙地改变数据的行数即可实现。而动态增加列只能自己写了，实现方式是将表格的列组件`el-table-column`使用`v-for`指令循环渲染，根据列的数量确定循环次数以此来确定表头。  

**表格重新渲染：** 上面提到当表格的列数量变化时表头也会随着数量的变化而变化，这时需要为表格设置key值，并且在列数量变化时修改key值以保证表格每次都会重新渲染。（后来发现没必要这么做）。

**每一个单元格能够有唯一的key值：** 因为还需要实现单元格的编辑（单击单元格可编辑）和表格右上三角不可编辑两个功能，所以需要唯一地确定每一个单元格（需要确定是哪个单元格被点击、哪个单元格不可编辑/点击），而`el-table`组件的单击回调方法参数cell中的`cellIndex`无法唯一确定单元格，需要自定义一下每个单元格的索引值。同时，单元格编辑时的input也要随着单元格确定一个key值。

**表格右上三角不可编辑：** 每个单元格的唯一索引确定了，这个就好做了，只需要设置一下单元格样式，并且当点击右上三角的单元格(`column.index > row.index`)时不做任何反应即可。

### 代码实现

> 部分核心代码和讲解。完整代码和效果可访问上面的codepen查看。

- 先来看看当表格的行列数量值发生改变时（动态增加行列）需要做些什么。从下面的代码中可以看出主要就是初始化数据和表头。

```javascript
handlerSelectChange(value) { // value就是表格的行列数量
    let tempTableThead = []
    let tempTableData = []
    let tableObjData = {}
    // 生成初始行数据
    for (let i = 1; i <= value; i++) {
        tableObjData['item' + i] = 1
    }
    // 初始化第一列表头
    tempTableThead.push({
      key: 'item0',
      label: ''
    })
    // 动态添加行和列
    for (let i = 1; i <= value; i++) {
      let temp = {}
      //添加列[表头]
      tempTableThead.push({
        key: 'item' + i,
        label: '因素' + i
      })
      //为每一行的第一列添加不用的因素名（值）
      temp['item0'] = '因素' + i
      // 复制属性
      Object.assign(temp, tableObjData)
      //添加行
      tempTableData.push(temp)
    }
    this.tableData = tempTableData
    this.formThead = tempTableThead
}
```

**HTML核心代码：** 

```vue
<el-table :key="key" :cell-class-name="tableCellClassName" :data="tableData" @cell-click="handleCellClick" :show-header="true" border :header-cell-style="tableHeadCellStyle" :cell-style="tableCellStyle">
    <el-table-column v-for="item in formThead" :key="item.key" :label="item.label">
       <template slot-scope="scope">
          <div :class="[inputClass]">
             <el-input ref="inputVal" size="small" @blur="handleInputBlur" v-model="scope.row[item.key]" :row-index=scope.$index @change="handleEdit($event,scope.row,scope.column)">
                </el-input>
           </div>
           <span :class="[spanClass]">{{ scope.row[item.key] }}</span>
        </template>
      </el-table-column>
</el-table>
```

- 使用`data` 属性为表格提供数据，需要动态生成行时改变数据行数即可。

- 使用`header-cell-style` 和`cell-style` 分别为表格的表头和右上三角的所有单元格设置样式（背景色）。

```javascript
// 表头单元格样式
tableHeadCellStyle({row,column,rowIndex,columnIndex}) {
   return 'background: #DCDCDC'
},
// 表格单元格样式
tableCellStyle({row,column,rowIndex,columnIndex}) {
   if (columnIndex > rowIndex) return 'background: #DCDCDC'
}
```

- 使用`v-for` 标签生成表格的列`el-table-column` , 需要动态生成列时改变`formThead` （即存放表头的数组）即可。

- 使用单元格的 className 的回调方法 `cell-class-name` 为每一个单元格设置唯一索引。

```javascript
// 给行列索引赋值，为了在点击单元格时可以唯一确定单元格
tableCellClassName({row,column,rowIndex,columnIndex}) { //注意这里是解构
    //利用单元格的 className 的回调方法，给行列索引赋值
    row.index = rowIndex;
    column.index = columnIndex;
}
```

- 每一个单元格中存放一个`div` 和`span` 标签，默认显示span，通过动态改变它们的class来改变css样式控制它们显示还是隐藏。**需要为input设置ref值，方便确定到底是哪一个input以获得input焦点。可以看出有多个ref值为inputVal的input，因为单元格有唯一索引，所以根据单元格的索引就可以确定是哪个input** 当单击单元格时，隐藏span，显示input并获取焦点；当input失去焦点时显示span，隐藏input。使用`cell-click` 事件监听单元格的单击。

- 使用`cell-click` 事件监听单元格点击，此时主要做的就是控制表格右上三角不可点击，同时需要显示input，并让input 获取焦点：

```javascript
handleCellClick(row, column, cell, event) {
   // cell中的cellIndex无法唯一确定单元格,我们自己定义
   // const cellIndex = cell.cellIndex
   const cellIndex = (this.form.value + 1) * row.index + column.index
   // 不让点击表格右上三角（包括对角线，其中对角线column.index-1 = row.index）
   if (column.index > row.index) {
       return
   }
   //显示input,隐藏span
   cell.childNodes[0].firstChild.className = "box-item-block"
   cell.childNodes[0].lastChild.className = "box-item-none"
   // 获取input焦点
   this.$nextTick(() => {
      // 获取到对应的第cellIndex个ref并获取焦点  
      this.$refs.inputVal[cellIndex].$el.querySelector('input').focus()
   })
}
```

- 在input框组件上使用`blur`事件监听失去焦点，此时隐藏input，显示span：

```javascript
handleInputBlur(event) {
   const _event = event
   const ev = _event.target.offsetParent.offsetParent.childNodes[0]
   if (_event && _event.target && _event.target.offsetParent &&
       _event.target.offsetParent.offsetParent && ev.firstChild &&
       ev.lastChild) {
         const inputElement = ev.firstChild
          const spanElement = ev.lastChild
          // 隐藏input,显示span
          inputElement.className = "box-item-none"
          spanElement.className = "box-item-block"
    }
}
```



--------

*参考：*

1. [Element-UI官方文档](https://element.eleme.cn/#/zh-CN/component/table)
2. [Element-UI可编辑表格的实现](https://blog.csdn.net/q95548854/article/details/83538192)
3. [获取elementUI Table单击的一个单元格的列和行](https://blog.csdn.net/KangTongShun/article/details/106003678)



