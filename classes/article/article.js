const fs = require("fs");
const { execSync } = require("child_process");
const { parseHTML } = require("linkedom");
const isEmail = require("email-regex-safe");
const path = require("path");
const {
  replace,
  supportedOrientation,
  supportedPaperSizes,
} = require("../../utils/utils");

module.exports = class IslamWebArticle {
  /**
   * كلاس للضغط المعلومات من على كود صفحة المقالة
   * @param {string} html كود صفحة المقالة
   */
  constructor(html) {
    this.source = html
      .replace(/\<font color="green"/gi, '<font color="#80e36a"')
      .replace(/\<font color="brown"/gi, '<font color="#dc5c53"')
      .replace(/\<font color="blue"/gi, '<font color="#1E90FF"');
  }

  /**
   * الحصول على جميع معلومات المقالة
   * @param {string} html محتوى المقالة نص عادي ام html
   * @returns { title: string | undefined, thumbnail: string | undefined, author: string | undefined, category: { name: string, link: string } | undefined, tree: string | undefined, publish: Date | undefined, article_content: string | undefined, article_number: number | undefined, related: { [key: string]: { title: string, url: string, short_url: string, img: string, type: string, number: number } }, language: string | undefined }
   */
  getDetails(html = false) {
    let document = parseHTML(this.source).document;
    let language =
      document.querySelector('link[rel="amphtml"]')?.href?.split("/")?.[4] ||
      "ar";
    document.querySelectorAll("a").forEach((e) => {
      if (e.href.startsWith(`/${language}/`)) {
        e.href = `https://islamweb.net${e.href}`;
      }
    });
    document.querySelectorAll("img").forEach((e) => {
      if (e.src.startsWith(`/${language}/`)) {
        e.src = `https://islamweb.net${e.src}`;
      }
    });
    document
      .querySelectorAll("span img[alt]")
      .forEach(
        (el) =>
          (el.outerHTML = `<span style="color:gold">${el.alt.trim()}</span>`)
      );

    let category = document.querySelector("ul li span + a");
    let publish = document
      .querySelector("ul meta + li")
      ?.textContent?.split(":")?.[1]
      ?.split("/");
    let related = {};
    let names = Array.from(document.querySelectorAll("span#tabs h1"));
    for (let i = 0; i < names.length; i++) {
      const element = names[i];
      let tab_index = element.getAttribute("tab");
      related[element.textContent.trim()] = Array.from(
        document.querySelectorAll(
          `#tab_container .tab_content.tab_${tab_index} div`
        )
      )
        .map((el) => {
          let e = el.querySelector("a");
          if (!e) return undefined;
          let img = el.querySelector("img")?.src
            ? `https://islamweb.net${el.querySelector("img")?.src}`
            : undefined;
          let type = e.href.split("/");
          if (e.href.includes("audio.islamweb.net")) {
            type[4] = "audio";
            type[5] = new URL(e.href).searchParams.get("audioid");
          }
          return {
            title: e?.textContent?.trim(),
            url: e.href ? `${e.href}` : undefined,
            short_url: e.href.split("/").slice(0, -1).join("/")
              ? `${e.href.split("/").slice(0, -1).join("/")}/`
              : undefined,
            img,
            type: type[4],
            number: isNaN(type[5]) ? null : +type[5],
          };
        })
        .filter(Boolean);
    }
    return {
      title:
        document
          .querySelector('h1[itemprop="headline"]')
          ?.textContent?.trim() || undefined,
      thumbnail: !!document
        .querySelector('img[itemprop="image"]')
        ?.getAttribute("SRC")
        ? `https://islamweb.net${document
            .querySelector('img[itemprop="image"]')
            ?.getAttribute("SRC")}`
        : undefined,
      author:
        document.querySelector("author")?.textContent ||
        document.querySelector('meta[itemprop="author"]')?.content ||
        undefined,
      category: category
        ? {
            name: category.textContent.trim(),
            link: `${category.href}`,
          }
        : undefined,
      tree:
        Array.from(document.querySelectorAll("ol li"))
          .map((e) => e.textContent.trim())
          .join(" >> ") || undefined,
      publish: publish
        ? new Date(+publish[2], +publish[1] - 1, +publish[0] + 1)
        : undefined,
      article_content:
        (document.querySelector(".bodytext") ||
          document.querySelector(".articletxt"))?.[
          html ? "innerHTML" : "textContent"
        ]?.trim() || undefined,
      article_number: isNaN(
        document
          .querySelector('link[rel="amphtml"]')
          ?.href?.split("/")
          ?.reverse()?.[1]
      )
        ? null
        : +document
            .querySelector('link[rel="amphtml"]')
            .href?.split("/")
            .reverse()[1],
      related,
      language,
    };
  }

  /**
   * طباعة محتوى المقالة الى ملف pdf
   * @param {object} param0 
   * @param {Boolean} param0.headersAndFooters اضافة عناوين ورابط المقالة؟
   * @param {Number} param0.margin المساحة المفرغة بين النصوص
   * @param {"A0" | "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8" | "A9" | "B0" | "B1" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7" | "B8" | "B9" | "C5E" | "Comm10E" | "DLE" | "Executive" | "Folio" | "Ledger" | "Legal" | "Letter" | "Tabloid"} param0.size حجم وشكل الملف المطبوع 
   * @param {"Portrait" | "Landscape"} param0.orientation شكل الصفحة بالطول او العرض
   * @param {string} param0.executablePath مسار برنامج الطبع (wkhtmltopdf)
   * @returns {Promise<Buffer>}
   */
  async print(
    {
      headersAndFooters,
      margin,
      size,
      orientation,
      executablePath,
    } = {
      headersAndFooters: true,
      margin: 6,
      size: "Letter",
      orientation: "Portrait",
      executablePath: process.env.WKHTMLTOPDF,
    }
  ) {
    headersAndFooters = Boolean(headersAndFooters);
    margin = isNaN(margin) || margin < 0 ? 6 : margin;
    size = supportedPaperSizes.includes(size) ? size : "Letter";
    orientation = supportedOrientation.includes(orientation)
      ? orientation
      : "Portrait";
    executablePath = fs.existsSync(executablePath)
      ? executablePath
      : process.env.WKHTMLTOPDF;
    if (!executablePath) {
      throw new ReferenceError(
        `Can't Find WkHtmlToPdf executable File \`set the path in process.env.WKHTMLTOPDF or in the options\``
      );
    }
    let d = this.getDetails(true);
    if (!d.title || !d.article_content) {
      throw new Error("check if this is a valid fatwa url - or refetch...");
    }
    let cmd = `"${executablePath}" `;
    cmd += `--log-level none -s "${size}" -O "${orientation}" --enable-local-file-access `;
    if (headersAndFooters) {
      cmd += `--header-left "${replace(
        d.language == "ar" ? `{islamic_date}` : `{title}`,
        d
      )}" `;
      cmd += `--header-right "${replace(
        d.language == "ar" ? `{title}` : `{islamic_date}`,
        d
      )}" `;
      cmd += `--footer-left "${this.url}" `;
      cmd += `--footer-right "Page [page]/[topage]" `;
    }
    cmd += `-T ${margin}mm -B ${margin}mm `;
    cmd += `-L ${Math.floor(margin / 2)}mm -R ${Math.floor(margin / 2)}mm `;
    cmd += `--footer-font-size 8 - -`;
    return execSync(cmd, {
      input: fs
        .readFileSync(
          path.resolve(
            __dirname,
            "..",
            "..",
            "utils",
            "templates",
            d.content_explain ? "fatwa" : "article",
            "index.html"
          ),
          "utf-8"
        )
        .replace('"{DIRECTION}"', d.language == "ar" ? "rtl" : "ltr")
        .replace(
          "{IMG}",
          d.thumbnail
            ? `<div><center><img src=${d.thumbnail} style="margin: 10px;height: 450px;"></center></div>`
            : ``
        )
        .replace(/\{BODY\}/gi, d.article_content),
      maxBuffer: 99999999999999999999,
    });
  }

  /**
   * رابط نشر على الوتس اب او التويتر او ايميل
   * @param {"whatsapp"|"twitter"|string} media 
   * @returns {string} 
   */
  share(media = "whatsapp") {
    let { title } = this.getDetails();
    if (media === "whatsapp") {
      return `https://api.whatsapp.com/send?text=${encodeURIComponent(
        this.url
      )}`;
    } else if (media === "twitter") {
      return `https://twitter.com/intent/tweet?original_referer=${encodeURIComponent(
        "https://www.islamweb.net/"
      )}&ref_src=${encodeURIComponent(
        "twsrc^tfw|twcamp^buttonembed|twterm^share|twgr^"
      )}&text=${encodeURIComponent(title)}&url=${encodeURIComponent(this.url)}`;
    } else if (isEmail({ exact: true }).test(media)) {
      return `mailto:${encodeURIComponent(media)}?subject=${encodeURIComponent(
        title
      )}&body=${encodeURIComponent(this.url)}`;
    }
    throw new Error("Only 'whatsapp', 'twitter', 'mail' available");
  }

  get url() {
    let { language, article_number } = this.getDetails();
    return `https://www.islamweb.net/${language}/article/${article_number}/`;
  }
};
