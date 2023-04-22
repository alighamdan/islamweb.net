const { default: axios } = require("axios");
const { parseHTML } = require("linkedom");
const IslamWebArticle = require("./article");
const iconv_lite = require("iconv-lite");

/**
 * بحث على المقالات
 * @param {string} query
 * @param {object} options
 * @param {"splitted_words" | "hole_words"} options.type نوع البحث كلمات متتالية او كلمات متبعثره
 * @param {boolean} options.only_titles البحث في عنوان المقالة ام في محتوى المقالة
 * @param {number} options.start بدأ المقالات - للصفحات استخدم next_page
 * @param {boolean} options.fullFetch بحث عميق؟ الحصول على مقالات على {@link IslamWebArticle}
 * @param {boolean} options.html الحصول على المحتوى كhtml
 * @returns {Promise<{ articles: IslamWebArticle[], next_page: number }|{ articles: { title: string, url: string, article_number: number }[], next_page: number }>}
 */
async function search(query, options = {}) {
  if (!query) throw new Error("Query is Required");
  if (!options.type) options.type = "splitted_words";
  if (!options.only_titles) options.only_titles = false;
  if (isNaN(options.start)) options.start = 0;
  if (!options.fullFetch) options.fullFetch = false;
  if (!options.html) options.html = false;
  let whereToSearch;
  let R1;
  if (options.type == "hole_words") {
    R1 = 1;
  } else {
    R1 = 0;
  }

  if (options.only_titles) {
    whereToSearch = 1;
  } else {
    whereToSearch = 0;
  }

  let res = await axios.postForm(
    "https://search.islamweb.net/ver3/ar/SearchEngine/arttab.php",
    {
      wheretosearch: whereToSearch,
      R1,
      txt: query,
      start: options.start,
    },
    { responseType: options.fullFetch ? "text" : "arraybuffer" }
  );

  if (options.fullFetch) {
    let document = parseHTML(res.data).window.document;
    return {
      articles: (
        await Promise.all(
          Array.from(document.querySelectorAll("ul li")).map(async (el) => {
            let url = `https://islamweb.net${el.querySelector("a").href}`;
            try {
              let r = await axios.get(url);
              return new IslamWebArticle(r.data);
            } catch (error) {
              return undefined;
            }
          })
        )
      )
        .filter(Boolean)
        .filter((a) => {
          let d = a.getDetails();
          if (!d.article_content || !d.title) return false;
          return true;
        }),
      next_page: +(
        document
          .querySelectorAll("option")
          [
            Array.from(document.querySelectorAll("option")).findIndex(
              (e) => !!e?.hasAttribute("selected")
            ) + 1
          ]?.getAttribute("value") || 0
      ),
    };
  } else {
    let document = parseHTML(iconv_lite.decode(res.data, "windows-1256")).window
      .document;
    return {
      articles: Array.from(document.querySelectorAll("ul.oneitems li")).map(
        (el) => {
          return {
            title: el
              .querySelector("h2 a")
              ?.[options.html ? "innerHTML" : "textContent"]?.trim(),
            url: el.querySelector("h2 a")?.href
              ? `https://islamweb.net${el.querySelector("h2 a")?.href}`
              : undefined,
            article_number: +(
              el.querySelector("h2 a")?.href?.split("/")?.[3] || 0
            ),
          };
        }
      ),
      next_page: +(
        document
          .querySelectorAll("option")
          [
            Array.from(document.querySelectorAll("option")).findIndex(
              (e) => !!e?.hasAttribute("selected")
            ) + 1
          ]?.getAttribute("value") || 0
      ),
    };
  }
}

/**
 * الحصول على المقالات والمقترحات من على صفحة المقالات الرئيسية
 * @returns {Promise<{suggested: { title: string, url: string, image: string, short_content: string, category: string }[],top: { title: string, url: string, image: string, short_content: string }[], editor_pick: { title: string, url: string, image: string, category: string }[], new_articles: { title: string, url: string, image: string, category: string }[], todays_article: { title: string, url: string, image: string, category: { name: string, url: string } }, sub_sections: { title: string, url: string }[]}>}
 */
async function homepage() {
  let { data: html } = await axios.get("https://islamweb.net/ar/articles/");
  let document = parseHTML(html).window.document;
  let suggested = Array.from(document.querySelectorAll(".articlemain > div"))
    .filter((e) => !e.className.includes("cloned"))
    .map((el) => {
      let t1 = el.querySelector("h2 a");
      el.querySelector("p a")?.remove();
      return {
        title: t1?.textContent?.trim(),
        url: t1.href ? `https://islamweb.net${t1.href}` : undefined,
        image: el.querySelector("img")?.src
          ? `https://islamweb.net${el.querySelector("img").src}`
          : undefined,
        short_content: el.querySelector("p")?.textContent?.trim(),
        category: Boolean(el.querySelector(".categorynem").href)
          ? `https://islamweb.net/ar/articles/${
              el.querySelector(".categorynem").href
            }`
          : undefined,
      };
    });
  let top = Array.from(
    document.querySelectorAll(".selectedarticles ul li")
  ).map((el) => {
    el.querySelector("p a")?.remove();
    return {
      title: el.querySelector("a")?.textContent?.trim(),
      url: `https://islamweb.net${el.querySelector("a")?.href}`,
      image: el.querySelector("img")?.getAttribute("SRC")
        ? `https://islamweb.net${el.querySelector("img")?.getAttribute("SRC")}`
        : undefined,
      short_content: el.querySelector("p").textContent.trim(),
    };
  });
  let editor_pick = [];
  let t = Array.from(document.querySelectorAll("#tabs h1"));
  for (let i = 0; i < t.length; i++) {
    const tab = t[i];
    let tab_id = tab.getAttribute("tab");
    let tab_name = tab.textContent.trim();

    let a = Array.from(
      document.querySelectorAll(
        `#tab_container .tab_content.tab_${tab_id} ul li`
      )
    );

    for (let j = 0; j < a.length; j++) {
      const art = a[j];
      editor_pick.push({
        title: art.querySelector("h2 a")?.textContent?.trim(),
        url: `https://islamweb.net${art.querySelector("h2 a").href}`,
        image: art.querySelector("img")?.getAttribute("SRC")
          ? `https://islamweb.net${art
              .querySelector("img")
              ?.getAttribute("SRC")}`
          : undefined,
        category: tab_name,
      });
    }
  }

  let news = [];
  t = Array.from(document.querySelectorAll("#tabstwo h1"));
  for (let i = 0; i < t.length; i++) {
    const tab = t[i];
    let tab_id = tab.getAttribute("tab");
    let tab_name = tab?.textContent?.trim();

    let a = Array.from(
      document.querySelectorAll(`#contabstwo .tabstwo_${tab_id} ul li`)
    );
    for (let j = 0; j < a.length; j++) {
      const art = a[j];
      news.push({
        title: art.querySelector("h2 a")?.textContent?.trim(),
        url: `https://islamweb.net${art.querySelector("h2 a").href}`,
        image: art.querySelector("img")?.getAttribute("SRC")
          ? `https://islamweb.net${art
              .querySelector("img")
              ?.getAttribute("SRC")}`
          : undefined,
        category: tab_name,
      });
    }
  }
  t = document.querySelector(".mostviewleft div");
  let todays_article = {
    title: t.querySelector("h2 a")?.textContent?.trim(),
    url: `https://islamweb.net${t.querySelector("h2 a").href}`,
    image: t.querySelector("img")?.getAttribute("SRC")
      ? `https://islamweb.net${t.querySelector("img")?.getAttribute("SRC")}`
      : undefined,
    category: {
      name: t.querySelector("samp a")?.textContent?.trim(),
      url: `https://islamweb.net${t.querySelector("samp a").href}`,
    },
  };

  let sub_sections = Array.from(
    document.querySelectorAll(".left-nav ul:not([class]) li")
  ).map((el) => ({
    title: el.querySelector("a").textContent,
    url: `https://islamweb.net${el.querySelector("a").href}`,
  }));
  return {
    suggested,
    top,
    editor_pick,
    new_articles: news,
    todays_article,
    sub_sections,
  };
}


/**
 * 
 * @param {string} url رابط مجموعة المقالات
 * @param {boolean} fullFetch بحث عميق
 * @returns {Promise<folders: { name: string, url: string }[], articles: IslamWebArticle[] | { title: string, url: string, article_number: number, publish: Date, short_content: string }[], sub_sections: { title: string, url: string }[], pages: { previous: string, current: number, next: string, last: number }>}
 */
async function get_articles(url, fullFetch = false) {
  if (!url) throw new Error("Url is Required");
  let { data: html } = await axios.get(url);
  let document = parseHTML(html).window.document;
  let folders = Array.from(document.querySelectorAll("ul.tree.two li")).map(
    (el) => {
      let urL = el.querySelector("a")?.href;
      if (!urL) {
        urL = el.querySelector("a")?.getAttribute("onclick")?.split("'")?.[3];
        if (urL) urL = `https://islamweb.net${urL}`;
        else urL = undefined;
      }
      return {
        name: el.querySelector("a")?.textContent?.trim(),
        url: urL,
      };
    }
  );
  let articles = (
    fullFetch
      ? (
          await Promise.all(
            Array.from(
              document.querySelectorAll(".itemslist ul.oneitems li")
            ).map(async (el) => {
              let url = el.querySelector("h2 a").href
                ? `https://islamweb.net${el.querySelector("h2 a").href}`
                : undefined;
              if (!url) return undefined;
              try {
                let res = await axios.get(url);
                return new IslamWebArticle(res.data);
              } catch (error) {
                return undefined;
              }
            })
          )
        )
          .filter(Boolean)
          .filter((a) => {
            let d = a.getDetails();
            return !!d.article_content && !!d.title;
          })
      : Array.from(document.querySelectorAll(".itemslist ul.oneitems li")).map(
          (el) => {
            let title = el.querySelector("h2 a")?.textContent?.trim();
            let url = el.querySelector("h2 a")?.href
              ? `https://islamweb.net${el.querySelector("h2 a")?.href}`
              : undefined;
            if (!url) return undefined;
            let article_number = +url.split("/")[5];
            let publish = el.querySelector("samp a")?.textContent?.trim()
              ? new Date(el.querySelector("samp a")?.textContent?.trim())
              : undefined;
            el.querySelectorAll("*").forEach((e) => e.remove());
            let short_content = el.textContent?.trim();

            return {
              title,
              url,
              article_number,
              publish,
              short_content,
            };
          }
        )
  ).filter(Boolean);
  let sub_sections = Array.from(
    document.querySelectorAll(".left-nav ul:not([class]) li")
  ).map((el) => ({
    title: el.querySelector("a").textContent,
    url: `https://islamweb.net${el.querySelector("a").href}`,
  }));
  let previous_page;
  let current_page;
  let next_page;
  let last_page = 0;
  let t = Array.from(document.querySelectorAll("ul.pagination li"));
  for (let i = 0; i < t.length; i++) {
    const l = t[i];
    if (l.className.includes("active")) {
      previous_page = t[i - 1]
        ? `${url.split("?")[0]}${t[i - 1].querySelector("a").href}`
        : undefined;
      current_page = +l.querySelector("a").textContent.trim();
      next_page = t[i + 1]
        ? `${url.split("?")[0]}${t[i + 1].querySelector("a").href}`
        : undefined;
    }
    let pn = l.querySelector("a")?.href?.split("=")?.[1];
    if (pn > last_page) last_page = +pn;
  }

  return {
    folders,
    articles,
    sub_sections,
    pages: {
      previous: previous_page,
      current: current_page,
      next: next_page,
      last: last_page,
    },
  };
}

/**
 * الحصول على كامل معلومات المقالة
 * @param {string} url 
 * @returns {Promise<IslamWebArticle>}
 */
async function get_article(url) {
  if (!url) throw new Error("Url is required");
  let { data: html } = await axios.get(url);
  return new IslamWebArticle(html);
}

module.exports.search = search;
module.exports.homepage = homepage;
module.exports.get_articles = get_articles;
module.exports.get_article = get_article;
