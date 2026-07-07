# 三只书虫

版本：v0.2.0

三位好友一起使用的轻量读书打卡网页。每个人只保留一本当前在读书籍，每天点亮一颗星；读完后写下读后感，并在「回响」里互相阅读和评论。

## v0.2.0 更新

- 底部导航调整为四个入口：打卡、小书屋、回响、我的。
- 新增「回响」页面，按最近完成时间倒序展示三位好友的完整读后感。
- 新增「小书屋」页面，展示三个人在同一个书房里的阅读痕迹和最近已读书脊。
- 每条回响支持纯文本评论，评论包含评论人、内容和时间。
- 后端新增回响与评论接口，Supabase 共享状态可继续读取和保存。
- 统一精修整体视觉风格，并让三个页面在标题、卡片和局部配色上有轻微区分。

## 页面结构

- 打卡：当前首页，展示三个人当前在读的书，并为自己的书点亮今日星星。
- 小书屋：展示三个人共享的小书房、轻微人物动态和最近已读书脊。
- 回响：展示已完成书籍的读后感 Feed 和评论。
- 我的：查看自己的已读书籍、个人笔记和待补读后感。

## 添加到手机桌面

每个人先在手机浏览器里打开自己的专属入口：

```text
https://three-bookers.onrender.com/yuki
https://three-bookers.onrender.com/momo
https://three-bookers.onrender.com/lusi
```

然后选择“添加到主屏幕”。添加后桌面会显示三只书虫的星星图标，之后可以像打开 App 一样进入。

已经为三个专属入口分别配置了桌面应用入口，Yuki/Momo/Lusi 从自己的链接添加到桌面后，会继续打开自己的页面。

## 本机临时共享

1. 电脑和手机连接同一个 Wi-Fi。
2. 在这个文件夹里启动应用：

```bash
npm start
```

3. 终端会显示一个类似这样的手机访问地址：

```text
http://192.168.x.x:4173
```

4. 三个人可以分别打开自己的专属入口：

```text
http://192.168.x.x:4173/yuki
http://192.168.x.x:4173/momo
http://192.168.x.x:4173/lusi
```

也可以打开普通地址后，在页面顶部切换身份。

## 数据保存

共享数据会保存在：

```text
data/state.json
```

只要大家访问的是同一台电脑启动的这个服务，就会看到同一份书籍、打卡和读书笔记数据。

## API

- `GET /api/state`：读取完整共享状态。
- `PUT /api/state`：保存完整共享状态。
- `GET /api/echoes`：读取所有可见读后感，按完成日期倒序返回，并包含评论。
- `GET /api/comments?bookId=...`：读取评论；不传 `bookId` 时返回全部评论。
- `POST /api/comments`：保存一条评论。

## 线上部署

朋友不在同一个网络时，需要部署到公网，并使用线上数据库。推荐：

- Render：运行这个网页服务
- Supabase：保存三个人共享的数据

### 1. 创建 Supabase 数据库

1. 新建 Supabase project。
2. 打开 SQL Editor。
3. 运行本项目里的 `supabase.sql`。
4. 在 Project Settings 里复制：
   - Project URL
   - service_role key

### 2. 部署到 Render

1. 把这个项目上传到一个 GitHub 仓库。
2. 在 Render 新建 Web Service，连接这个仓库。
3. Start Command 使用：

```bash
npm start
```

4. 添加环境变量：

```text
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SECRET_KEY=你的 Supabase secret key
SUPABASE_STATE_ID=main
```

5. 部署完成后，Render 会给你一个公网网址。

### 3. 分享给三个人

假设公网网址是：

```text
https://three-bookers.onrender.com
```

三个人可以分别使用：

```text
https://three-bookers.onrender.com/yuki
https://three-bookers.onrender.com/momo
https://three-bookers.onrender.com/lusi
```
