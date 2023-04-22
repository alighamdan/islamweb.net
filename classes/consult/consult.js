const { parseHTML } = require("linkedom");
const {
  replace,
  supportedOrientation,
  supportedPaperSizes,
} = require("../../utils/utils");
const fs = require("fs");
const path = require("path");
const isEmail = require("email-regex-safe");
const { execSync } = require("child_process");

module.exports = class IslamWebConsult {
  /**
   * كلاس للضغط المعلومات من على كود صفحة الإستشارة
   * @param {string} html كود صفحة الإستشارة
   */
  constructor(html) {
    this.source = html
      .replace(/\<font color="green"/gi, '<font color="#80e36a"')
      .replace(/\<font color="brown"/gi, '<font color="#dc5c53"')
      .replace(/\<font color="blue"/gi, '<font color="#1E90FF"');
  }

  /**
   * الحصول على جميع معلومات الإستشارة
   * @param {string} html محتوى الإستشارة نص عادي ام html
   * @returns { title: string | undefined, author: string | undefined, tree: string | undefined, publish: Date | undefined, consult_question: string | undefined, consult_number: number | undefined, related: { [key: string]: { title: string, url: string, short_url: string, img: string, type: string, number: number } }, language: string | undefined, consult_answer: string | undefined, comments: { comment: string, author: string, author_country: string }[] | undefined }
   */
  getDetails(html = false) {
    let document = parseHTML(this.source).window.document;
    let language =
      document.querySelector('link[rel="amphtml"]')?.href?.split("/")?.[4] ||
      "ar";
    document
      .querySelectorAll("span img[alt]")
      .forEach(
        (el) =>
          (el.outerHTML = `<span style="color:gold">${el.alt.trim()}</span>`)
      );

    let tree =
      Array.from(document.querySelectorAll("ol li"))
        .map((e) => e.textContent.trim())
        .join(" >> ") || undefined;
    let consult_number = +document
      .querySelector('h1[itemprop="name"] strong')
      ?.textContent?.split(":")?.[1]
      ?.trim();
    document
      .querySelectorAll('h1[itemprop="name"] *')
      .forEach((e) => e.remove());
    let title = document
      .querySelector('h1[itemprop="name"]')
      ?.textContent?.trim();
    let publish = document
      .querySelector(".mainitemdetails ul li")
      ?.textContent?.split(":")
      ?.slice(1)
      ?.join(":")
      ? new Date(
          document
            .querySelector(".mainitemdetails ul li")
            .textContent.split(":")
            .slice(1)
            .join(":")
        )
      : undefined;
    let consult_question = document
      .querySelectorAll('div[itemprop="text"]')?.[0]
      ?.[html ? "innerHTML" : "textContent"]?.trim();
    let consult_answer = document
      .querySelectorAll('div[itemprop="text"]')?.[1]
      ?.[html ? "innerHTML" : "textContent"]?.trim();

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
          e.href = `https://islamweb.net${e.href}`;
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
            img,
            type: type[4],
            number:
              new URL(e.href).searchParams?.get("id") ||
              new URL(e.href).searchParams?.get("audioid"),
          };
        })
        .filter(Boolean);
    }

    let comments = Array.from(document.querySelectorAll("ul.iteml02 li")).map(
      (el) => {
        let country =
          el.querySelector("h2 span")?.textContent?.trim() || undefined;
        el.querySelector("h2 span")?.remove();
        return {
          comment: el.querySelector("p")?.textContent?.trim(),
          author: el.querySelector("h2")?.textContent?.trim(),
          author_country: country,
        };
      }
    );

    let most_view = Array.from(
      document.querySelectorAll(".mostviewleft ul li")
    ).map((el) => {
      return {
        title: el.querySelector("h2 a")?.textContent?.trim(),
        url: el.querySelector("h2 a")?.href
          ? `https://islamweb.net/${language}/consult/${
              el.querySelector("h2 a")?.href
            }`
          : undefined,
        views: el.querySelector("span")?.textContent
          ? +el.querySelector("span")?.textContent
          : undefined,
        category: {
          name: el.querySelector("h2 + a")?.textContent?.trim(),
          url: el.querySelector("h2 + a")?.href
            ? `${el.querySelector("h2 + a")?.href}`
            : undefined,
        },
      };
    });

    return {
      tree,
      consult_number,
      title,
      publish,
      consult_question,
      consult_answer,
      related,
      comments,
      most_view,
      author: document
        .querySelector(".mainitemdetails li + li")
        ?.textContent?.split(":")
        ?.slice(1)
        ?.join(":")
        ?.trim(),
      language,
    };
  }

  /**
   * طباعة محتوى الإستشارة الى ملف pdf
   * @param {object} param0
   * @param {Boolean} param0.headersAndFooters اضافة عناوين ورابط الإستشارة؟
   * @param {Number} param0.margin المساحة المفرغة بين النصوص
   * @param {"A0" | "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8" | "A9" | "B0" | "B1" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7" | "B8" | "B9" | "C5E" | "Comm10E" | "DLE" | "Executive" | "Folio" | "Ledger" | "Legal" | "Letter" | "Tabloid"} param0.size حجم وشكل الملف المطبوع
   * @param {"Portrait" | "Landscape"} param0.orientation شكل الصفحة بالطول او العرض
   * @param {string} param0.executablePath مسار برنامج الطبع (wkhtmltopdf)
   * @returns {Promise<Buffer>}
   */
  async print(
    {
      headersAndFooter: headersAndFooters,
      margin,
      size,
      orientation,
      executablePath,
    } = {
      headersAndFooter: true,
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
    if (!d.title || !d.consult_question || !d.consult_answer) {
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
      cmd += `--footer-left "https://www.islamweb.net/${d.language}/consult/index.php?page=Details&id=${d.consult_number}" `;
      cmd += `--footer-right "Page [page]/[topage]" `;
    }
    cmd += `-T ${margin}mm -B ${margin}mm `;
    cmd += `-L ${Math.floor(margin / 2)}mm -R ${Math.floor(margin / 2)}mm `;
    cmd += `--footer-font-size 8 - -`;
    return execSync(cmd, {
      input: fs
        .readFileSync(
          path.resolve(__dirname, "../../utils/templates/fatwa/index.html"),
          "utf-8"
        )
        .replace(/\{QUESTION\}/gi, d.consult_question)
        .replace(/\{ANSWER\}/gi, d.consult_answer)
        .replace('"{DIRECTION}"', d.language == "ar" ? "rtl" : "ltr"),
      maxBuffer: 99999999999999999999,
    });
  }

  /**
   * رابط نشر على الوتس اب او التويتر او ايميل
   * @param {"whatsapp"|"twitter"|string} media
   * @returns {string}
   */
  share(media = "whatsapp") {
    let d = this.getDetails();
    if (media === "whatsapp") {
      return `https://api.whatsapp.com/send?text=${encodeURIComponent(
        `https://www.islamweb.net/${d.language}/consult/index.php?page=Details&id=${d.consult_number}`
      )}`;
    } else if (media === "twitter") {
      return `https://twitter.com/intent/tweet?original_referer=${encodeURIComponent(
        "https://www.islamweb.net/"
      )}&ref_src=${encodeURIComponent(
        "twsrc^tfw|twcamp^buttonembed|twterm^share|twgr^"
      )}&text=${encodeURIComponent(d.title)}&url=${encodeURIComponent(
        `https://www.islamweb.net/${d.language}/consult/index.php?page=Details&id=${d.consult_number}`
      )}`;
    } else if (isEmail({ exact: true }).test(media)) {
      return `mailto:${encodeURIComponent(media)}?subject=${encodeURIComponent(
        d.title
      )}&body=${encodeURIComponent(
        `https://www.islamweb.net/${d.language}/consult/index.php?page=Details&id=${d.consult_number}`
      )}`;
    }
    throw new Error("Only 'whatsapp', 'twitter', 'mail' available");
  }

  get url() {
    let { language, consult_number } = this.getDetails();
    return `https://www.islamweb.net/${language}/consult/index.php?page=Details&id=${consult_number}`;
  }
};
