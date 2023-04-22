const { default: axios } = require("axios");
const { parseHTML } = require("linkedom");
const iconv_lite = require("iconv-lite");
const IslamWebLibrary = require("./library");

async function search(query, options = {}) {
  if (!query) throw new Error("query is required");
  if (!options.type) options.type = "splitted_words";
  if (!options.only_titles) options.only_titles = false;
  if (!options.bookId) options.bookId = -1;
  if (!options.fullFetch) options.fullFetch = false;
  if (!options.html) options.html = false;
  let res = await axios.postForm(
    "https://search.islamweb.net/ver3/ar/SearchEngine/libtab.php",
    {
      wheretosearch: options.only_titles ? 1 : 0,
      R1: options.type === "hole_words" ? 1 : 0,
      txt: query,
      bookid: options.bookId,
    },
    {
      responseType: options.fullFetch ? "text" : "arraybuffer",
    }
  );
  let document;
  let tabs = [];
  if (options.fullFetch) {
    document = parseHTML(res.data).window.document;
    tabs = (
      await Promise.all(
        Array.from(document.querySelectorAll("ul.oneitems li")).map(
          async (el) => {
            let url = el.querySelector("h2 a")?.href
              ? `https://islamweb.net${el.querySelector("h2 a").href}`
              : undefined;
            if (!url) return undefined;
            try {
              let res = await axios.get(url);
              return new IslamWebLibrary(res.data);
            } catch (error) {
              return undefined;
            }
          }
        )
      )
    )
      .filter(Boolean)
      .filter((l) => {
        let d = l.getDetails();
        return !!d.title && !!d.bookName && !!d.tab_content;
      });
  } else {
    document = parseHTML(iconv_lite.decode(res.data, "windows-1256")).window
      .document;
    let t = document.querySelectorAll("ul.oneitems li");
    for (let i = 0; i < t.length; i++) {
      const element = t[i];
      let bookName = element.querySelector("h2 a")?.textContent?.trim();
      let url = element.querySelector("h2 a")?.href
        ? `https://islamweb.net${element.querySelector("h2 a").href}`
        : undefined;
      if (!url) continue;
      let short_content = element
        .querySelector("p")
        ?.[options.html ? "innerHTML" : "textContent"]?.trim();
      let category = element.querySelector("p + p")?.textContent.trim();
      let book_id;
      let tab_id;
      try {
        book_id = new URL(url).searchParams.get("bk_no");
        tab_id = new URL(url).searchParams.get("ID");
      } catch (error) {}
      tabs.push({
        bookName,
        url,
        short_content,
        category,
        book_id,
        tab_id,
      });
    }
  }
  let next_page = document
    .querySelectorAll("option")
    [
      Array.from(document.querySelectorAll("option")).findIndex(
        (e) => !!e?.hasAttribute("selected")
      ) + 1
    ]?.getAttribute("value");

  return { tabs, next_page };
}

async function get_books() {
  let { data: html } = await axios.get(
    "https://www.islamweb.net/ar/library/index.php?page=bookslist"
  );
  let document = parseHTML(html).window.document;

  return Array.from(document.querySelectorAll("ul.oneitems li")).map((el) => {
    let Pages = +el
      .querySelector('meta[itemprop="numberOfPages"]')
      ?.getAttribute("content");
    let bookName = el.querySelector("h2 a label")?.textContent?.trim();
    let url = el.querySelector("h2 a")?.href
      ? `https://islamweb.net/ar/library/${el.querySelector("h2 a")?.href}`
      : undefined;
    let author = el
      .querySelector('label[itemprop="author"]')
      ?.textContent?.trim();
    let subject = el.querySelector("samp.floatl a[href]")?.href
      ? `https://islamweb.net/ar/library/${
          el.querySelector("samp.floatl a[href]")?.href
        }`
      : undefined;
    let bookId = new URL(url).searchParams.get("bk_no");

    return {
      bookName,
      bookId,
      url,
      Pages,
      author,
      subject,
    };
  });
}

async function homepage() {
  let { data: html } = await axios.get("https://www.islamweb.net/ar/library/");
  let document = parseHTML(html).window.document;
  let suggested_books = Array.from(document.querySelectorAll(".newsbc"))
    .filter((e) => !e.className.includes("cloned"))
    .map((el) => {
      let url = el.querySelector("h2 a")?.href
        ? `https://islamweb.net/ar/library/${el.querySelector("h2 a")?.href}`
        : undefined;
      if (!url) return undefined;
      return {
        bookName: el.querySelector("h2 a")?.textContent?.trim(),
        bookId: new URL(url).searchParams.get("bk_no"),
        url,
        img: el.querySelector("img")?.src
          ? `https://islamweb.net/ar/library/${el.querySelector("img").src}`
          : undefined,
        author: el.querySelector("p")?.textContent?.trim(),
      };
    })
    .filter(Boolean);

  let selected_tabs = Array.from(
    document.querySelectorAll(".selectedarticles .fouritems li")
  )
    .map((el) => {
      let title = el.querySelector("h2 a")?.textContent?.trim();
      let url = el.querySelector("h2 a")?.href
        ? `https://islamweb.net/ar/library/${el.querySelector("h2 a")?.href}`
        : undefined;
      if (!url) return undefined;
      let tab_id = url ? new URL(url).searchParams.get("ID") : undefined;
      let short_content = el.querySelector("p.moktatafat")?.textContent?.trim();
      let bookUrl = el.querySelector(".bokname a")?.href
        ? `https://islamweb.net/ar/library/${
            el.querySelector(".bokname a")?.href
          }`
        : undefined;
      let bookName = el.querySelector(".bokname a")?.textContent?.trim();
      let bookId = bookUrl
        ? new URL(bookUrl).searchParams.get("bk_no")
        : undefined;
      let author = el.querySelector(".bokuser")?.textContent?.trim();

      return {
        title,
        url,
        tab_id,
        book: { name: bookName, url: bookUrl, id: bookId },
        author,
        short_content,
      };
    })
    .filter(Boolean);

  let imams = Array.from(document.querySelectorAll(".itemslist ul li"))
    .map((el) => {
      let url = el.querySelector("h2 a")?.href
        ? `https://islamweb.net/ar/library/${el.querySelector("h2 a")?.href}`
        : undefined;
      if (!url) return undefined;
      el.querySelector("p a")?.remove();
      return {
        name: el.querySelector("h2 a")?.textContent?.trim(),
        url,
        short_content: el.querySelector("p")?.textContent?.trim(),
      };
    })
    .filter(Boolean);

  return {
    suggested_books,
    selected_tabs,
    imams,
  };
}

async function get_tabs(url) {
  if (!url)
    url = "https://www.islamweb.net/ar/library/index.php?page=TreeCategory";
  let { data: html } = await axios.get(url);
  let document = parseHTML(html).window.document;

  let folders = Array.from(document.querySelectorAll("ul.tree.two li")).map(
    (el) => {
      let urL = el.querySelector("a")?.href;
      if (!urL) {
        urL = el.querySelector("a")?.getAttribute("onclick")?.split("'")?.[3];
      }
      if (urL) urL = `https://islamweb.net/ar/library/${urL}`;
      return {
        name: el.querySelector("a")?.textContent?.trim(),
        url: urL,
      };
    }
  );

  let tabs = Array.from(document.querySelectorAll("ul.oneitems li"))
    .map((el) => {
      let urL = el.querySelector("h2 a")?.href
        ? `https://islamweb.net/ar/library/${el.querySelector("h2 a")?.href}`
        : undefined;
      if (!urL) return undefined;
      let title = el.querySelector("h2 a")?.textContent?.trim();
      let bookId = new URL(urL).searchParams.get("bk_no");
      let tab_id = new URL(urL).searchParams.get("ID");
      let tree = el.querySelector("br + a")?.textContent?.trim();

      return { title, url: urL, bookId, tabId: tab_id, tree };
    })
    .filter(Boolean);

  let previous_page;
  let current_page;
  let next_page;
  let last_page = 0;
  let t = Array.from(document.querySelectorAll("ul.pagination li"));
  for (let i = 0; i < t.length; i++) {
    const l = t[i];
    if (l.className.includes("active")) {
      previous_page = t[i - 1]
        ? `${url.split("?")[0]}?${
            t[i - 1].querySelector("a").href.split("?")[1]
          }`
        : undefined;
      current_page = +l.querySelector("a").textContent.trim();
      next_page = t[i + 1]
        ? `${url.split("?")[0].split("&")[0]}?${
            t[i + 1].querySelector("a").href.split("?")[1]
          }`
        : undefined;
    }
    let pn = l
      .querySelector("a")
      ?.href?.split("&")
      ?.reverse()?.[0]
      ?.split("=")[1];
    if (pn > last_page) last_page = +pn;
  }

  return {
    tabs,
    folders,
    pages: {
      previous: previous_page,
      next: next_page,
      current: current_page,
      last: last_page,
    },
  };
}

async function get_tab(url) {
  if (!url) throw new Error("Url is required")
  let { data:html } = await axios.get(url);
  return new IslamWebLibrary(html);
}

module.exports.search = search;
module.exports.get_books = get_books;
module.exports.homepage = homepage;
module.exports.get_tabs = get_tabs;
module.exports.get_tab = get_tab;