/** @type {import('./_venera_.js')} */

class Roum29 extends ComicSource {
    name = "肉漫屋"
    key = "roum29"
    version = "2.2.0"
    minAppVersion = "1.6.0"

    // 指向本源文件本身，用于 VeneraX 更新
    url = "https://cdn.jsdelivr.net/gh/xuhao910216/roum29.js@main/roum29.js"

    baseUrl = "https://roum29.xyz"
    pageSize = 24

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://roum29.xyz/"
    }

    async request(url) {
        let res = await Network.get(url, this.headers)
        if (res.status < 200 || res.status >= 400) {
            throw `HTTP ${res.status}: ${url}`
        }
        return res.body
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

    attr(el, names) {
        if (!el) return ""
        for (let name of names) {
            let v = el.attributes?.[name]
            if (v) return String(v)
        }
        return ""
    }

    imageUrl(el) {
        if (!el) return ""
        let src = this.attr(el, [
            "data-src",
            "data-original",
            "data-lazy-src",
            "data-image",
            "data-url",
            "src"
        ])
        if (!src || /^data:image/i.test(src)) return ""
        return this.absUrl(src)
    }

    isComicUrl(url) {
        try {
            let u = new URL(url, this.baseUrl)
            let p = u.pathname.split("/").filter(Boolean)
            return p.length === 2 && p[0] === "books"
        } catch (e) {
            return false
        }
    }

    isChapterUrl(url) {
        try {
            let u = new URL(url, this.baseUrl)
            let p = u.pathname.split("/").filter(Boolean)
            return p.length === 3 && p[0] === "books"
        } catch (e) {
            return false
        }
    }

    parseList(html) {
        let doc = new HtmlDocument(html)
        let links = doc.querySelectorAll('a[href^="/books/"], a[href*="/books/"]')
        let comics = []
        let seen = {}

        for (let link of links) {
            let href = this.attr(link, ["href"])
            let id = this.absUrl(href)
            if (!this.isComicUrl(id) || seen[id]) continue

            let card = link
            let parent = link.parent

            for (let i = 0; i < 5 && parent; i++) {
                if (parent.querySelector("img")) {
                    card = parent
                    break
                }
                parent = parent.parent
            }

            let title = this.clean(
                card.querySelector?.(".title, .name, h2, h3, [class*='title'], [class*='name']")?.text
            ) || this.clean(link.text)

            title = title
                .replace(/第\s*\d+\s*[话話回].*$/i, "")
                .trim()

            if (!title) continue

            let cover = this.imageUrl(card.querySelector?.("img"))

            let subtitle = this.clean(
                card.querySelector?.(".subtitle, .author, .meta, .status, .latest, .chapter")?.text
            )

            comics.push(new Comic({
                id: id,
                title: title,
                subTitle: subtitle,
                cover: cover,
                tags: [],
                description: ""
            }))

            seen[id] = true
        }

        doc.dispose()
        return comics
    }

    async loadBooks(path, page) {
        let p = page || 1
        let url = this.baseUrl + path

        if (p > 1) {
            url += (url.includes("?") ? "&" : "?") + "page=" + p
        }

        let html = await this.request(url)
        let comics = this.parseList(html)

        return {
            comics: comics,
            maxPage: comics.length < this.pageSize ? p : p + 1
        }
    }

    explore = [
        {
            title: "热门推荐",
            type: "multiPageComicList",
            load: async (page) => await this.loadBooks("/", page)
        },
        {
            title: "全部漫画",
            type: "multiPageComicList",
            load: async (page) => await this.loadBooks("/books", page)
        },
        {
            title: "连载漫画",
            type: "multiPageComicList",
            load: async (page) => await this.loadBooks("/books?continued=true", page)
        },
        {
            title: "完结漫画",
            type: "multiPageComicList",
            load: async (page) => await this.loadBooks("/books?continued=false", page)
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
                            attributes: { category: "all", param: "all" }
                        }
                    },
                    {
                        label: "连载",
                        target: {
                            page: "category",
                            attributes: { category: "continued", param: "continued" }
                        }
                    },
                    {
                        label: "完结",
                        target: {
                            page: "category",
                            attributes: { category: "completed", param: "completed" }
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

            // 站点若调整搜索参数，依次尝试常见参数
            let urls = [
                `${this.baseUrl}/search?keyword=${q}&page=${p}`,
                `${this.baseUrl}/search?q=${q}&page=${p}`,
                `${this.baseUrl}/search?search=${q}&page=${p}`
            ]

            for (let url of urls) {
                try {
                    let html = await this.request(url)
                    let comics = this.parseList(html)
                    if (comics.length > 0) {
                        return {
                            comics: comics,
                            maxPage: comics.length < this.pageSize ? p : p + 1
                        }
                    }
                } catch (e) {}
            }

            return { comics: [], maxPage: 1 }
        },
        optionList: [],
        enableTagsSuggestions: false
    }

    comic = {
        loadInfo: async (id) => {
            let url = this.absUrl(id)

            if (!this.isComicUrl(url)) {
                throw `Invalid comic id: ${id}`
            }

            let html = await this.request(url)
            let doc = new HtmlDocument(html)

            let title =
                this.clean(doc.querySelector("h1")?.text) ||
                this.clean(doc.querySelector(".comic-title, .book-title, [class*='title']")?.text) ||
                "肉漫屋漫画"

            let cover = ""
            for (let img of doc.querySelectorAll("img")) {
                let src = this.imageUrl(img)
                if (src && !/loading\.jpg|logo|favicon|avatar|icon/i.test(src)) {
                    cover = src
                    break
                }
            }

            let description = this.clean(
                doc.querySelector(".description, .desc, .summary, .intro, [class*='description']")?.text
            )

            let author = this.clean(
                doc.querySelector(".author, [class*='author']")?.text
            )

            let status = this.clean(
                doc.querySelector(".status, [class*='status']")?.text
            )

            let chapters = new Map()
            let chapterLinks = doc.querySelectorAll('a[href^="/books/"], a[href*="/books/"]')

            for (let link of chapterLinks) {
                let href = this.absUrl(this.attr(link, ["href"]))
                if (!this.isChapterUrl(href)) continue

                let chapterTitle = this.clean(link.text)
                if (!chapterTitle) continue

                chapters.set(href, chapterTitle)
            }

            let tags = {}
            if (status) tags["状态"] = status
            if (author) tags["作者"] = [author]

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

            doc.dispose()
            return result
        },

        loadEp: async (comicId, epId) => {
            let url = this.absUrl(epId || comicId)

            if (!this.isChapterUrl(url)) {
                throw `Invalid chapter id: ${url}`
            }

            let html = await this.request(url)
            let doc = new HtmlDocument(html)

            let images = []
            let seen = {}

            for (let img of doc.querySelectorAll("img")) {
                let src = this.imageUrl(img)
                if (!src) continue
                if (/loading\.jpg|logo|favicon|avatar|icon/i.test(src)) continue

                if (!seen[src]) {
                    seen[src] = true
                    images.push(src)
                }
            }

            // 兼容图片地址藏在页面脚本中的情况
            if (images.length === 0) {
                let regex = /https?:\/\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"'\\\s]*)?/gi
                let matches = html.match(regex) || []

                for (let src of matches) {
                    src = src.replace(/\\u0026/g, "&").replace(/\\\//g, "/")
                    if (/loading\.jpg|logo|favicon|avatar|icon/i.test(src)) continue

                    if (!seen[src]) {
                        seen[src] = true
                        images.push(src)
                    }
                }
            }

            doc.dispose()

            if (images.length === 0) {
                throw "未找到章节图片，可能是网站结构变化或图片需要额外脚本加载。"
            }

            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => ({
            url: url,
            headers: this.headers
        }),

        onThumbnailLoad: (url) => ({
            url: url,
            headers: this.headers
        }),

        idMatch: "https?://roum29\\.xyz/books/[^/]+",

        link: {
            domains: ["roum29.xyz", "www.roum29.xyz"],

            linkToId: (url) => {
                try {
                    let u = new URL(url)
                    if (u.hostname !== "roum29.xyz" && u.hostname !== "www.roum29.xyz") {
                        return null
                    }

                    let parts = u.pathname.split("/").filter(Boolean)
                    if (parts.length >= 2 && parts[0] === "books") {
                        return `${u.origin}/books/${parts[1]}`
                    }
                } catch (e) {}

                return null
            }
        }
    }
}

new Roum29()