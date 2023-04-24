# islamweb.net [![NPM Version](https://img.shields.io/npm/v/islamweb.net.svg?style=flat-square&color=informational)](https://github.com/alighamdan/islamweb.net)

Unofficial islamweb.net library for node.js
<br />
islamweb.net is a library that can help you to reach to the data with simple ways

## features:

- fast
- easy
- don't use much ram
- can print the content to pdf
  <br />

## requirements

if you want to **print the content to pdf**
<br />
you will need `wkhtmltopdf` cli
[download](https://github.com/wkhtmltopdf/packaging/releases/0.12.6-1)

the selected version is the tested one

## usage:

```js
const {
    article, articleClass
    consult, consultClass,
    fatwa, fatwaClass,
    library, libraryClass,
    surah, apps
} = require('islamweb.net');

// Article Section

const {
    search, homepage,
    get_articles, get_article
} = article;

/* article.search */
let options = {
    /*
    you can use also "hole_words",
    this is the searching type how to use the words and how to find the result
    */
    type: "splitted_words",
    /*
    search on titles? true
    search on the hole article? false
    */
    only_titles: false,
    /*
    this is like .slice but for the results
    if there is more than 35 result you will get
    next_page: number,
    use the next_page here to get the next video.
    */
    start: 0,
    /*
    this is deep search - i don't recommend it
    because it take so long,
    if this is true,
    you will get the result as articleClass.
    */
    fullFetch: false,
    /*
    if you want to return `title` as html
    this option will work if `fullFetch` is false
    */
    html: false
}

/*
    return Promise
    if the fullFetch is true you will get this data:
    { articles: articleClass[], next_page?: number }
    and if the fullFetch is false you will get:
    { articles: Array<{ title, url, article_number }>, next_page?: number }
    title is string, if html was true title will be an html.
    url is the article url. (string)
    article_number is the article id. (number)

note (problem):
    if you made fullFetch: true
    you will see that the articles
    are not 35 (maybe less)
    because some requests in islamweb.net fails
    so its just a request then fail
    but if you reRequest again you will see valid data
    (if its a valid url)
    so its not an issue from the library, its from
    islamweb.net
*/
await search(query, options);


/* article.homepage */
/*
    (there is no options here)

    this homepage fetches the article homepage url and give you this data as Promise:
    {
        suggested: Array<{ title, url, image, short_content, category }>,
        top: Array<{ title, url, image, short_content }>,
        editor_pick: Array<{ title, url, image, category }>,
        new_articles: Array<{ title, url, image, category }>,
        todays_article: { title, url, category },
        sub_sections: Array<{ title, url }>
    }
    title: string, url: string
    image: is the image of the article - (if available).
    short_content: is a short content from the article
    category: is the category of the article
        all are string, except: todays_article is:
            { name: string, url: string }

    suggested: the suggested articles
    top: the top articles
    editor_pick: like google play but in islamweb.net
    new_articles: the new articles...
    todays_article: the article of the day
    sub_sections: categories (use get_articles for the url to get all of the articles in the url...)
*/
await homepage();

/* article.get_articles */
/*
    url: of the sub_section
    (you can get them from homepage or any...)
    fullFetch: as before, returns articleClass
    but the same issue, take to long.

    the data returns as Promise:
    {
        folders: Array<{ name, url }>,
        articles: Array<articleClass (if fullFetch is true) | { title, url, article_number, publish, short_content }>,
        sub_sections: Array<{ title, url }>
        pages: { previous, current, next, last }
    }
    folders: are like the sub_(sub_section of the url).

    articles[]: the articles.
    publish is the publish date (Date class),
    pages:
        previous: the previous page url,
        current: the current page number,
        next: the next page url,
        last: the last page number
    they might be undefined,
    you can get the url and use get_articles
    again and will give you all the articles of the previous/next page.
*/
await get_articles(url, fullFetch);

/* article.get_article */
/*
    if you don't use fullFetch
    and you don't need to fetch all the articles
    you can fetch specific article by its url
    just use this function, will return articleClass
*/
await get_article(url);

/* articleClass */
/*
    articleClass is IslamWebArticle (exported with `articleClass` name)

    html: is the source code of the article page (fetch then new articleClass with the html source code)
    but you can use get_article(url)
    it will fetch for you and make it for you.

    articleClass have 3 functions 2 properties.
    properties:
        1. source: the html it self.
        2. url: make for you the article url.
    functions:
        1. share(media): make a url to share the article
            supported media: whatsapp, twitter
            and you can put a mail, you will get mailto: protocol.
        2. print(options): this is the super mega printer, doesn't use puppeteer so no big memory use. it uses `wkhtmltopdf`,
        this function will give you: Promise<Buffer>
        the buffer of the pdf.
        simply you can use fs.writeFileSync or whatever you like, all works.

        options are like this:
        {
            headersAndFooters: boolean,
            margin: number,
            size: string (Letter, ..etc),
            orientation: string (Portrait | Landscape),
            executablePath: string
        }
        headersAndFooters (default is true): add headers and footers to the pdf
            left-header -> title (en) | date (ar)
            right-header -> title (ar) | date(en)

            left-footer -> url of the article
            right-footer -> Page x/y
        margin (default is 6):
            the margin of the page
            the left and right margin are divided by 2
            when margin is 6, left and right are 3.
        size: there are a lot of sizes
        my best choice is Letter. (the default).
        orientation: default is Portrait.
        executablePath (default: process.env.WKHTMLTOPDF):
            this is the most important thing
            you must add it.
            this is the `wkhtmltopdf` file path, required
        3. getDetails(html = false): this getDetails give you all data in the article page (i think everything can help you). if you saw the title was undefined and the basic information was undefined try to reFetch the page again (if the url is valid).
            data is:
                title: string,
                thumbnail: string,
                author: string,
                category: {
                    name: string,
                    link: string
                },
                tree: string,
                publish: Date,
                article_content: string,
                article_number: number,
                related: {
                    [key: string]: Array<{
                        title: string,
                        url: string, short_url: string,
                        img: string,
                        type: string,
                        number: number
                    }>
                },
                language: string | 'ar'

            tree: is the tree sections to the article.
            thumbnail: the image of the article.
            article_content: could be html if html is true. (you can make it md and use it...).
            related: unknown key
            it might be: "المقالات" or "المكتبة"
            these are the related libraries. audio, fatwa, consult.
            (No audio support for now).
            language: the article language.
*/
new articleClass(html);

// Consult Section

const {
    search, homepage,
    get_consults, get_consult
} = consult;

/* consult.search */
/*
    actually search on all of:
    article, consult, fatwa, library

    are the same function for different data.

    if fullFetch is true return Promise of:
    {
        consults: Array<consultClass>,
        next_page: number
    }
    but if its false returns:
    {
        consults: Array<{ title, url, consult_number }>,
        next_page: number
    }
*/
await search(query, options);

/* consult.homepage */
/*
    return Promise
    if fullFetch is true:
    {
        top: Array<consultClass>,
        consult_subjects: Array<{ title, url }>,
        most_view: Array<{
            title: string,
            url:string,
            views: number (can be NaN at the most time),
            category: {
                name: string, url: string
            }
        }>
    }
    if fullFetch is false:
    top returns: Array<{ title, url, consult_number }>

    consult_subjects: sub-sections like.
    most_view: most viewed consults.
    top: most top consults.
*/
await homepage(fullFetch);

/* consult.get_consults */
/*
    returns: {
        consults: Array<consultClass (if fullFetch) | {
            title, url, consult_number, short_content
        }>,
        folders: Array<{ name, url }> (Sub_section),
        pages: {
            previous, current, next, last
        }
        pages are the same of before
    }
*/
await get_consults(url, fullFetch);


/* consult.get_consult */
/*
    same returns Promise of consultClass
*/
await get_consult(url);

/* consultClass */
/*
    articleClass => IslamWebArticle
    consultClass => IslamWebConsult

    same as articleClass
    they work the same work
    but getDetails have small changes
    no article_content
    but there is:
    consult_question,
    consult_answer.

    there is comments:
    Array<{
        comment: string,
        author: string,
        author_country: string
    }>
*/
new consultClass(html);


// Fatwa Section

const {
    search, homepage,
    get_fatawa, get_fatwa
} = fatwa;

/* fatwa.search */
/*
  same options
  returns Promise of: {
    fatwas: Array<fatwaClass | { title, url, fatwa_number}>,
    next_page: number
  }
  fatwaClass if fullFetch is true
*/
await search(query, options);

/* fatwa.homepage */
/*
    returns (Promise): {
        top: Array<fatwaClass | { title, url, fatwa_number }>,

        news: Array<fatwaClass | { title, url, fatwa_number, short_content }>,

        fatwa_subjects: Array<{ name, url }>,

        most_view: Array<{ title, url, views, category: { name, url } }>
    }
    top: top fatwas
    news: newest fatwas
    fatwa_subjects: its sub-section like.
    most_view: most viewed fatwa.
*/
await homepage(fullFetch);

/* fatwa.get_fatawa */
/*
    returns Promise: {
        fatwas: Array<fatwaClass | {
            title, url, fatwa_number,
            short_content
        }>,
        folders: Array<{ name, url }>,
        sub_sections: Array<{ title, url }>,
        pages: {
            previous, current, next, last
        }
    }
*/
await get_fatawa(url, fullFetch);

/* fatwa.get_fatwa */
/*
    returns (Promise) fatwaClass
*/
await get_fatwa(url);

/* fatwaClass */
/*
    fatwaClass => IslamWebFatwa
    same all.
    getDetails
    give you:
    fatwa_question, fatwa_answer
    related, fatwa_subjects, most_view

    you can see the data in your terminal more clear.
*/
new fatwaClass(html);

// library section

const {
    search, get_books, homepage,
    get_tabs, get_tab
} = library;

/* library.search */
/*
    same...
    {
        tabs: Array<libraryClass | {
            bookName, url, short_content,
            category, book_id, tab_id
        }>,
        next_page: number
    }
    bookName => the book name.
    url => the tab url.
    short_content => short content from the tab
    category => the tab category.
    book_id => the book id.
    tab_id => the tab id.
*/
await search(query, options);

/* library.get_books */
/*
    return Promise (all books from islamweb.net):
    {
        bookName: string,
        bookId: string,
        url: string,
        Pages: number,
        author: string,
        subject: string,

    }
*/
await get_books();

/* library.homepage */
/*
    returns Promise:
    {
        suggested_books: Array<{
            bookName: string,
            bookId: string,
            url: string,
            img: string,
            author: string
        }>,
        selected_tabs: Array<{
            title: string,
            url: string,
            tab_id: string,
            book: {
                name: string,
                url: string,
                id: string
            },
            author: string,
            short_content: string
        }>,
        imams: Array<{
            name: string,
            url: string,
            short_content: string
        }>
    }

    suggested_books: suggested from islamweb
    selected_tabs: suggested tabs.
    imams: some imams(إمام) and about him.
*/
await homepage();

/* library.get_tabs */
/*
    like get_articles, get_fatawa, get_consults

    return: {
        tabs,
        folders,
        pages: {
            previous, current, next, last
        }
    }

    tabs -> Array<{ title, url, bookId, tabId, tree }>
    (tree category of the tab).
*/
await get_tabs(url);

/* library.get_tab */
/*
    return new libraryClass (IslamWebLibrary).
*/
await get_tab(url);

/*
i think i explained everything in the article section.
i think i didn't repeat a lot of thing.
*/

// remains 2 things: surah, apps
/*
    these are simple data.
*/

surah // quran soar in array
/*
like this:
[
    "الفاتحة",
    "البقرة"
    ... etc (114 all)
];
*/

apps;
/*
there is 3 apps developed by islamweb.net
so i think if i shared every possible info
about them will be good.

1. fiqh library
2. hadith library
3. quran tafseer library

every app have 32 book inside

the `apps` returns (3 elements only):
Array<{
    name: string -> the app Name,
    features: Array<string> -> app features,
    url: string -> the download url
    size: number -> the software size in bytes,
    books: Array<{
        name: string -> Book name,
        author: string -> book creator,
        author_birth: number -> in hijri,
        author_death: number -> in hijri,
        parts: number -> book parts,
        publisher: string -> the publisher,
        category: string -> book category,
        id: number -> book_id in islamweb (you can use it in library search ..etc)
    }> -> software books,
    release_date: string -> date in year (date/hijri)
}>
*/

```

## contribute:

open `pull request`. (no rules nothing).
<br />

\+ thanks for support.

## issues?

open `new issue` in github and i'll help you
inshallah.

## License?

this project is open source, its npm
you can use it for free.
<br />
i will take nothing from you
