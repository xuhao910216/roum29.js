/** @type {import('./_venera_.js')} */

class Roum29 extends ComicSource {
    name = "肉漫屋"
    key = "roum29"
    version = "2.1.0"
    minAppVersion = "1.6.0"

    // Venera 源的 url 必须指向“JS 源文件本身”，不能填写漫画网站首页。
    // 本版本按你的 VeneraX 增强版仓库预留地址配置。
    url = "https://cdn.jsdelivr.net/gh/xuhao910216/roum29.js@main/roum29.js"

    baseUrl = "https://roum29.xyz"
    pageSize = 24

    headers = {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://roum29.xyz/"
    }

    async request(url) {
        let res = await fetch(url, {
            headers: this.headers
        })

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${url}`)
        }

        return res
    }

    absUrl(url) {
        if (!url) return ""
        url = String(url).trim()

        if (url.startsWith("//")) return "https:" + url
        if (/^https?:\/\//i.test(url)) return url

        if (url.startsWith("/")) return this.baseUrl + url
        return this.baseUrl + "/" + url
    }

    clean(text) {
        return String(text || "").replace(/\s+/g, " ").trim()
    }

    parseId(url) {
        return this.absUrl(url)
    }

    getAttr(element, names) {
        if (!element) return ""

        for (let name of names) {
            let value = element.attributes?.[name]
            if (value) return value
        }

        return ""
    }

    getImage(element) {
        if (!element) return ""

        let src = this.getAttr(element, [
            "data-src",
            "data-original",
            "data-lazy-src",
            "data-image",
            "data-url",
            "src"
        ])

        if (!src) return ""
        if (/^data:image/i.test(src)) return ""

        return this.absUrl(src)
    }

    /**
     * roum29 当前列表页的漫画链接统一使用：
     * /books/{漫画ID}
     *
     * 详情页章节统一使用：
     * /books/{漫画ID}/{章节号}
     */
    isComicUrl(url) {
        try {
            let u = new URL(url, this.baseUrl)
            let parts = u.pathname.split("/").filter(Boolean)

            return (
                parts.length === 2 &&
                parts[0] === "books"
            )
        } catch (e) {
            return false
        }
    }

    isChapterUrl(url) {
        try {
            let u = new URL(url, this.baseUrl)
            let parts = u.pathname.split("/").filter(Boolean)

            return (
                parts.length === 3 &&
                parts[0] === "books"
            )
        } catch (e) {
            return false
        }
    }

    makeComic(element) {
        let link = element

        if (element.querySelector) {
            link =
                element.querySelector('a[href^="/books/"]') ||
                element.querySelector('a[href*="/books/"]') ||
                element
        }

        if (!link) return null

        let href = this.getAttr(link, ["href"])
        if (!href) return null

        let id = this.parseId(href)

        if (!this.isComicUrl(id)) return null

        let title = this.clean(link.text)

        if (element !== link) {
            let titleElement = element.querySelector(
                ".title, .name, h2, h3, [class*='title'], [class*='name']"
            )

            if (titleElement && this.clean(titleElement.text)) {
                title = this.clean(titleElement.text)
            }
        }

        title = title
            .replace(/第\s*\d+\s*話.*$/i, "")
            .replace(/第\s*\d+\s*话.*$/i, "")
            .trim()

        if (!title) return null

        let img = element.querySelector ? element.querySelector("img") : null
        let cover = this.getImage(img)

        let subtitle = ""
        if (element !== link) {
            subtitle = this.clean(
                element.querySelector(
                    ".subtitle, .author, .meta, .status, .latest, .chapter"
                )?.text
            )
        }

        return new Comic({
            id: id,
            title: title,
            subTitle: subtitle,
            cover: cover,
            tags: [],
            description: ""
        })
    }

    parseList(html) {
        let document = new HtmlDocument(html)
        let links = document.querySelectorAll('a[href^="/books/"]')

        let comics = []
        let seen = {}

        for (let link of links) {
            let href = this.getAttr(link, ["href"])
            let full = this.absUrl(href)

            if (!this.isComicUrl(full)) continue
            if (seen[full]) continue

            // 取漫画链接所在卡片，封面一般在卡片内部。
            let container = link.parent

            for (let i = 0; i < 4 && container; i++) {
                let candidate = container.querySelector("img")
                if (candidate) break
                container = container.parent
            }

            let comic = this.makeComic(container || link)

            if (!comic) continue

            // 如果父节点解析不到标题，使用链接文字。
            if (!comic.title) {
                comic.title = this.clean(link.text)
            }

            seen[comic.id] = true
            comics.push(comic)
        }

        document.dispose()

        return comics
    }

    async loadBooks(path, page) {
        let p = page || 1
        let url = this.baseUrl + path

        if (p > 1) {
            url += (url.includes("?") ? "&" : "?") + "page=" + p
        }

        let res = await this.request(url)
        let comics = this.parseList(await res.text())

        // roum29 当前列表页显示总页数，例如 1 / 48。
        // 没有可靠 total API，因此根据当前页是否满页判断下一页。
        let maxPage = comics.length < this.pageSize ? p : p + 1

        return {
            comics: comics,
            maxPage: maxPage
        }
    }

    explore = [
        {
            title: "热门推荐",
            type: "multiPageComicList",

            load: async (page) => {
                return await this.loadBooks("/", page)
            }
        },
        {
            title: "全部漫画",
            type: "multiPageComicList",

            load: async (page) => {
                return await this.loadBooks("/books", page)
            }
        },
        {
            title: "连载漫画",
            type: "multiPageComicList",

            load: async (page) => {
                return await this.loadBooks("/books?continued=true", page)
            }
        },
        {
            title: "完结漫画",
            type: "multiPageComicList",

            load: async (page) => {
                return await this.loadBooks("/books?continued=false", page)
            }
        }
    ]

    category = {
        title: "漫画分类",

        parts: [
            {
                name: "状态",
                type: "fixed",

                categories: [
                    {
                        label: "全部",
                        target: {
                            page: "category",
                            attributes: {
                                category: "all",
                                param: "all"
                            }
                        }
                    },
                    {
                        label: "连载",
                        target: {
                            page: "category",
                            attributes: {
                                category: "continued",
                                param: "continued"
                            }
                        }
                    },
                    {
                        label: "完结",
                        target: {
                            page: "category",
                            attributes: {
                                category: "completed",
                                param: "completed"
                            }
                        }
                    }
                ]
            }
        ],

        enableRankingPage: false
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            if (param === "continued") {
                return await this.loadBooks("/books?continued=true", page)
            }

            if (param === "completed") {
                return await this.loadBooks("/books?continued=false", page)
            }

            return await this.loadBooks("/books", page)
        },

        optionList: []
    }

    search = {
        load: async (keyword, options, page) => {
            let p = page || 1
            let q = encodeURIComponent(String(keyword || "").trim())

            /*
             * roum29 的搜索页表单目前为 /search。
             * 同时兼容常见的 keyword / q 参数，避免站点调整参数后完全失效。
             */
            let urls = [
                `${this.baseUrl}/search?keyword=${q}&page=${p}`,
                `${this.baseUrl}/search?q=${q}&page=${p}`,
                `${this.baseUrl}/search?search=${q}&page=${p}`
            ]

            for (let url of urls) {
                try {
                    let res = await this.request(url)
                    let html = await res.text()
                    let comics = this.parseList(html)

                    if (comics.length > 0) {
                        return {
                            comics: comics,
                            maxPage: comics.length < this.pageSize ? p : p + 1
                        }
                    }
                } catch (e) {
                    // 尝试下一种搜索参数。
                }
            }

            return {
                comics: [],
                maxPage: 1
            }
        },

        optionList: [],
        enableTagsSuggestions: false
    }

    comic = {
        loadInfo: async (id) => {
            let url = this.absUrl(id)

            if (!this.isComicUrl(url)) {
                throw new Error("Invalid comic id: " + id)
            }

            let res = await this.request(url)
            let html = await res.text()
            let document = new HtmlDocument(html)

            let titleElement = document.querySelector("h1")
            let title = this.clean(titleElement?.text)

            if (!title) {
                title = this.clean(
                    document.querySelector(
                        ".comic-title, .book-title, [class*='title']"
                    )?.text
                )
            }

            if (!title) {
                title = "肉漫屋漫画"
            }

            let cover = ""

            let images = document.querySelectorAll("img")
            for (let img of images) {
                let src = this.getImage(img)

                if (
                    src &&
                    !/loading\.jpg|logo|favicon|avatar|icon/i.test(src)
                ) {
                    cover = src
                    break
                }
            }

            let description = this.clean(
                document.querySelector(
                    ".description, .desc, .summary, .intro, [class*='description']"
                )?.text
            )

            let author = this.clean(
                document.querySelector(
                    ".author, [class*='author']"
                )?.text
            )

            let status = this.clean(
                document.querySelector(
                    ".status, [class*='status']"
                )?.text
            )

            let chapters = new Map()
            let chapterLinks = document.querySelectorAll(
                'a[href^="/books/"]'
            )

            for (let link of chapterLinks) {
                let href = this.absUrl(this.getAttr(link, ["href"]))

                if (!this.isChapterUrl(href)) continue

                let chapterTitle = this.clean(link.text)

                if (!chapterTitle) continue

                chapters.set(href, chapterTitle)
            }

            /*
             * 当前网站详情页的章节本身按 1、2、3……排列。
             * Map 按网页出现顺序保存，避免把推荐漫画链接混进章节。
             */

            let tags = {
                "状态": status || "未知"
            }

            if (author) {
                tags["作者"] = [author]
            }

            let result = new ComicDetails({
                id: url,
                title: title,
                subtitle: author,
                cover: cover,
                tags: tags,
                description: description,
                chapters: chapters,
                url: url
            })

            document.dispose()

            return result
        },

        loadEp: async (comicId, epId) => {
            let url = epId || comicId
            url = this.absUrl(url)

            if (!this.isChapterUrl(url)) {
                throw new Error("Invalid chapter id: " + url)
            }

            let res = await this.request(url)
            let html = await res.text()
            let document = new HtmlDocument(html)

            let images = []
            let seen = {}

            /*
             * 阅读页的图片会使用 loading.jpg 占位。
             * 优先读取 data-src / data-original 等懒加载属性。
             */
            let imageElements = document.querySelectorAll("img")

            for (let img of imageElements) {
                let src = this.getImage(img)

                if (!src) continue
                if (/loading\.jpg|logo|favicon|avatar|icon/i.test(src)) {
                    continue
                }

                if (!seen[src]) {
                    seen[src] = true
                    images.push(src)
                }
            }

            /*
             * 如果网页把图片地址放进脚本而不是 img 属性，
             * 再从原始 HTML 中提取常见图片 URL。
             */
            if (images.length === 0) {
                let regex =
                    /https?:\/\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"'\\\s]*)?/gi

                let matches = html.match(regex) || []

                for (let src of matches) {
                    src = src.replace(/\\u0026/g, "&")
                    src = src.replace(/\\\//g, "/")

                    if (
                        /loading\.jpg|logo|favicon|avatar|icon/i.test(src)
                    ) {
                        continue
                    }

                    if (!seen[src]) {
                        seen[src] = true
                        images.push(src)
                    }
                }
            }

            document.dispose()

            if (images.length === 0) {
                throw new Error(
                    "未找到章节图片。该章节可能需要站点脚本加载图片，或网站结构已经发生变化。"
                )
            }

            return {
                images: images
            }
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                url: url,
                headers: {
                    "Referer": this.baseUrl + "/",
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                        "AppleWebKit/537.36 (KHTML, like Gecko) " +
                        "Chrome/120.0.0.0 Safari/537.36"
                }
            }
        },

        onThumbnailLoad: (url) => {
            return {
                url: url,
                headers: {
                    "Referer": this.baseUrl + "/",
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                        "AppleWebKit/537.36 (KHTML, like Gecko) " +
                        "Chrome/120.0.0.0 Safari/537.36"
                }
            }
        },

        idMatch: "https?://roum29\\.xyz/books/[^/]+",

        link: {
            domains: [
                "roum29.xyz",
                "www.roum29.xyz"
            ],

            linkToId: (url) => {
                try {
                    let u = new URL(url)

                    if (
                        u.hostname !== "roum29.xyz" &&
                        u.hostname !== "www.roum29.xyz"
                    ) {
                        return null
                    }

                    let parts = u.pathname.split("/").filter(Boolean)

                    if (
                        parts.length >= 2 &&
                        parts[0] === "books"
                    ) {
                        return `${u.origin}/books/${parts[1]}`
                    }
                } catch (e) {}

                return null
            }
        }
    }
}

new Roum29()