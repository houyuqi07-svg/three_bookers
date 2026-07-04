# 三只书虫

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
http://192.168.x.x:4173/?user=yuki
http://192.168.x.x:4173/?user=momo
http://192.168.x.x:4173/?user=lusi
```

也可以打开普通地址后，在页面顶部切换身份。

## 数据保存

共享数据会保存在：

```text
data/state.json
```

只要大家访问的是同一台电脑启动的这个服务，就会看到同一份书籍、打卡和读书笔记数据。

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
https://three-bookworms.onrender.com
```

三个人可以分别使用：

```text
https://three-bookworms.onrender.com/?user=yuki
https://three-bookworms.onrender.com/?user=momo
https://three-bookworms.onrender.com/?user=lusi
```
