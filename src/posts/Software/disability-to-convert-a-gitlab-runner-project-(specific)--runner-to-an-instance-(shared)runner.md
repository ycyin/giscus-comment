---
title: 避坑-不能将specific类型的gitlab-runner改变为share类型
tag: 
  - gitlab-runner
keywords:
  - gitlab
  - gitlab-runner
  - shared to specific
date: 2023-05-09 20:24:22
category: 软件安装&配置
description: 在gitlab中将类型为share的gitlab-runner改变为specific类型后不能将specific类型改变回share类型，只能重新注册
---
## 前言

在gitlab中将类型为share的gitlab-runner改变为specific类型后不能将specific类型改变回share类型，只能重新注册一个新的runner

![](./disability-to-convert-a-gitlab-runner-project-(specific)--runner-to-an-instance-(shared)runner/20230509202609.png)

GitLab版本：GitLab Community Edition [11.11.7](https://gitlab.com/gitlab-org/gitlab-ce/tags/v11.11.7) 

Runner版本：13.9.0

## 避坑

如果有一个shared类型的runner,在不确定的情况下不要将其配置修改（即试图在页面上将Runner配置下的Restrict projects for this Runner下添加指定项目），这会使得shared类型的runner变为specific类型，并且这是不可逆的，只有重新注册，这会带来不必要的麻烦，比如缓存文件失效、花费时间部署等。

根据验证，这确实是不可逆的，[Change Runner back to shared after marking it as specific](https://gitlab.com/gitlab-org/gitlab/-/issues/16167)

也不知道是什么原因造成这种不可逆的行为，直到Gitlab 15.0 中删除了这个特性。也就是说15.0后，不能将shared类型的runner转为specific类型。
![](./disability-to-convert-a-gitlab-runner-project-(specific)--runner-to-an-instance-(shared)runner/20230509203739.png)
[Remove ability to convert an instance (shared) runner to a project (specific) runner](https://gitlab.com/gitlab-org/gitlab/-/issues/345347)

## 参考
1. [https://docs.gitlab.com/ee/user/admin_area/settings/continuous_integration/](https://docs.gitlab.com/ee/user/admin_area/settings/continuous_integration/)
2. [https://www.perforce.com/manuals/gitswarm/ci/runners/README.html](https://www.perforce.com/manuals/gitswarm/ci/runners/README.html)