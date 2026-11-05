# dsh-open-in-codebuddy

[English](README.md) | 中文

在 DSH 会话右上角加一个 **CodeBuddy** 按钮，一键用当前会话的工作区目录在 [CodeBuddy](https://www.codebuddy.cn) 中打开。

## 安装

```sh
dsh plugin --profile <your-profile> add github:gokucai/dsh-open-in-codebuddy
```

或以 npm 包安装（预构建，免构建授权）：

```sh
dsh plugin --profile <your-profile> add dsh-open-in-codebuddy
```

本包声明了 `dsh.bundle`，安装后由 DSH 自动挂载为该 profile 的一个 bundle 层，无需手改 `cordis.patch.yml` 或 `package.json`。

## 效果

会话右上角会出现一个 CodeBuddy 按钮，紧邻 DSH 自带的「打开方式」按钮，外观与之一致：

```
[ ⧉ | ▾ ]            ← DSH 自带「打开方式」
[ </> CodeBuddy ]    ← 本插件
```

点击即以当前 Session 的工作区目录打开 CodeBuddy；启动过程中按钮显示忙碌态，失败时在按钮旁给出错误提示并在 6 秒后自动消失。未检测到 CodeBuddy 时按钮不渲染。

## 平台支持

| 平台 | 启动方式 |
|---|---|
| macOS | 优先使用 CodeBuddy 自带的 `Contents/Resources/app/bin/code -n <dir>`，以该目录为新窗口工作区打开；该 CLI 不存在时回退 `open -a` |
| Windows / Linux | PATH 上的 `codebuddy` / `cbc` / `codebuddy-code`，以该目录为工作目录启动 |

macOS 上会校验 bundle id 为 `com.tencent.codebuddycn`，因此重命名的安装仍可用，而同路径下的其它应用不会被误启动。

### 非标准安装路径

默认查找 `/Applications` 与 `~/Applications` 下的 `CodeBuddy CN.app` / `CodeBuddy.app`。装在别处时设置环境变量后重启 DSH：

```sh
export CODEBUDDY_APP_PATH="/path/to/CodeBuddy CN.app"
```

## 实现

- **Host 侧**（`index.js`）负责探测与启动 CodeBuddy，通过 `GET /open-in-codebuddy/status` 与 `POST /open-in-codebuddy/open` 两条路由暴露。两者都在 DSH 连接的信任栅栏（`ctx.connection.requestRejection`）之后，未认证与跨源请求在解析或启动之前就被拒；请求体限制 64 KiB、要求 `application/json`、路径必须是存在的绝对目录；启动不经 shell，参数按 argv 传递，进程 detached 且无 stdio 管道。
- **Client 侧**（`client.js`）以本插件自己的 cell id `open-in-codebuddy` 注册到 `conversation.session.header.utilities`，因此与 DSH 原生控件并存、互不影响。

DSH 自带的应用目录（`@deepseek-ai/dsh-host-open-in-app`）是编译期固定的表，没有配置扩展点，因此第三方无法把 CodeBuddy 追加进那个原生下拉框。槽位系统里，同 cell id 且同 priority 的重复注册会直接抛错，只有用更低的 priority 才能遮蔽原生控件 —— 那是整体接管它的 UI。本插件使用独立的 cell id，装上即生效、卸载即恢复，不动原生控件。

## 权限

本插件在 Host 侧以 DSH 进程自身的权限运行：读取应用安装信息、spawn 一个本地进程。它不访问网络、不读工作区文件、不接触凭据。

## 卸载

```sh
dsh plugin --profile <your-profile> remove dsh-open-in-codebuddy
```

## License

MIT
