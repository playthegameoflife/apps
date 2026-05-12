#!/usr/bin/env python3
"""
Combined Blog Generator: Prompt Helper Gemini + MyCombat
Powered by blog-master SEO structure
"""

import os, re, json, base64, subprocess, random, html as html_mod
from datetime import datetime, date

# Load env
for line in open(os.path.expanduser("~/.env")):
    if "=" in line and not line.startswith("#"):
        os.environ.setdefault(*line.strip().split("=", 1))

REPO_OWNER = "playthegameoflife"
REPO_NAME = "apps"

APPS = {
    "phg": {
        "name": "Prompt Helper Gemini",
        "short": "Prompt Helper Gemini",
        "extension_url": "https://chromewebstore.google.com/detail/prompt-helper-gemini/iggefchbkdlmljflfcnhahphoojnimbp",
        "logo": "https://raw.githubusercontent.com/playthegameoflife/apps/main/fitclick.png",
        "description": "Free Chrome extension that builds optimized prompts for any AI tool in seconds.",
        "author": "Alex Rivera",
        "author_title": "AI Productivity Specialist & Prompt Engineer",
        "cta": "Download Free on Chrome Web Store",
    },
    "mycombat": {
        "name": "MyCombat",
        "short": "MyCombat",
        "extension_url": "https://play.google.com/store/apps/details?id=com.gamifiedlivingapps.mycombat&hl=en",
        "logo": "https://raw.githubusercontent.com/playthegameoflife/apps/main/fitclick.png",
        "description": "Solo martial arts training app with voice guided workouts, combination generator, and customizable timers.",
        "author": "Alex Rivera",
        "author_title": "Martial Arts Enthusiast & App Developer",
        "cta": "Download Free on Google Play",
    }
}

SITE_DOMAIN = "gamifiedlivingapps.com"
STATE_FILE = "/root/.hermes/prompt_helper_blog_state.json"
MYCOMBAT_TOPICS_FILE = "/root/.hermes/scripts/mycombat_blog_topics.json"

BLOG_MASTER_PROMPT = """Write a 1,200+ word SEO blog post as clean HTML. Start directly with <h1>. No DOCTYPE, no <html>, no <head>, no <body>.

BUSINESS: {app_name}
KEYWORD: {primary_kw}
AUDIENCE: {audience}

STRUCTURE - use EXACT class names:
<h1 class="article-title">SEO TITLE</h1>
<p class="article-meta">By AUTHOR &bull; APP &bull; Free Guide</p>
<div class="article-lead"><p>Intro paragraph - hook + promise, 2 sentences.</p></div>
<div class="article-body">
<h2>Introduction</h2>
<p>150-200 words. Open with problem about {pain}. Address reader as "you". End with 3 takeaway bullets.</p>
<ul class="takeaway-list"><li>Specific takeaway 1</li><li>Specific takeaway 2</li><li>Specific takeaway 3</li></ul>
<h2>[H2 with keyword - Practical Foundation]</h2>
<p>Core content paragraphs with bullet points.</p>
<div class="callout-box"><p><strong>Key Insight:</strong> Practical 1-2 sentence tip about {primary_kw}.</p></div>
<h2>[H2 - Step by Step Guide]</h2>
<p>Brief intro, then numbered steps.</p>
<ol class="step-list"><li><strong>Step 1:</strong> Clear action</li><li><strong>Step 2:</strong> Clear action</li><li><strong>Step 3:</strong> Clear action</li><li><strong>Step 4:</strong> Clear action</li></ol>
<div class="callout-box callout-contrast"><div><strong>Before:</strong> What most do wrong</div><div><strong>After:</strong> What right approach delivers</div></div>
<h2>[H2 - Common Mistakes]</h2>
<ul class="mistake-list"><li><strong>Mistake 1:</strong> Why it fails and fix</li><li><strong>Mistake 2:</strong> Why it fails and fix</li><li><strong>Mistake 3:</strong> Why it fails and fix</li></ul>
<h2>[H2 - Pro Tips]</h2>
<p>Advanced advice and real examples.</p>
<div class="callout-box callout-pro"><p><strong>Pro Tip:</strong> One advanced actionable technique.</p></div>
<h2>Conclusion</h2>
<p>3 key takeaways. Personal closing. CTA to download {app_name}.</p>
<div class="faq-section"><h2>Frequently Asked Questions</h2>
<div class="faq-item"><h3>Is {app_name} free?</h3><p>Yes. No credit card required.</p></div>
<div class="faq-item"><h3>What does {app_name} do?</h3><p>{app_description}</p></div>
<div class="faq-item"><h3>How do I get started?</h3><p>Download free and start in seconds.</p></div>
</div>
</div>
<div class="article-footer"><h3>About the Author</h3><p><strong>{author}</strong> is a {author_title}.</p></div>

OUTPUT: Only the HTML. Start with <h1. Nothing else."""

def get_state():
    if os.path.exists(STATE_FILE):
        return json.load(open(STATE_FILE))
    return {"posted_blogs": [], "posted_today": []}

def save_state(s):
    json.dump(s, open(STATE_FILE, "w"), indent=2)

def get_github_token():
    creds = open(os.path.expanduser("~/.git-credentials")).read()
    m = re.search(r"https://[^:]+:([A-Za-z0-9_-]+)@github\.com", creds)
    return m.group(1)

GITHUB_TOKEN = get_github_token()

def api(cmd, method="GET", data=None, decode=True):
    full_cmd = ["curl", "-s", "-X", method,
                "-H", "Authorization: Bearer " + GITHUB_TOKEN,
                "-H", "Accept: application/vnd.github.v3+json"]
    if data:
        full_cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(data)]
    full_cmd.append("https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + cmd)
    r = subprocess.run(full_cmd, capture_output=True, text=True)
    return json.loads(r.stdout) if decode else r.stdout

def get_file(path):
    d = api(path)
    return base64.b64decode(d["content"]).decode(), d.get("sha")

def upd_file(path, content, msg, sha=None):
    payload = {"message": msg, "content": base64.b64encode(content.encode()).decode("ascii")}
    if sha:
        payload["sha"] = sha
    return api(path, "PUT", payload)

def get_related(slug, lim=3):
    try:
        sm, _ = get_file("sitemap.xml")
        urls = re.findall(r"<loc>([^<]+)</loc>", sm)
        return [{"url": u, "slug": u.split("/")[-1],
                 "title": u.split("/")[-1].replace("-", " ").replace(".html", "").title()}
               for u in urls[-lim:] if "/blog-" in u and slug not in u]
    except:
        return []

def load_mycombat_topics():
    with open(MYCOMBAT_TOPICS_FILE) as f:
        return json.load(f)

def phg_topic(seed):
    topics = [
        ("How to Write Better ChatGPT Prompts", "chatgpt prompts", "content creators", "generic outputs"),
        ("One-Click AI Prompt Enhancement", "ai prompt enhancement", "developers", "hours crafting"),
        ("Free Midjourney Prompt Generator", "midjourney prompts", "designers", "ai context"),
        ("Claude Prompt Writing Tips", "claude prompts", "writers", "brand voice"),
        ("Code Prompts That Work", "code prompts ai", "developers", "generic outputs"),
    ]
    random.seed(seed)
    t = topics[seed % len(topics)]
    return {"slug": "blog-" + t[1].replace(" ", "-") + "-" + str(seed) + ".html",
            "title": t[0], "primary_kw": t[1], "audience": t[2], "pain": t[3],
            "use_case": t[1], "app": "phg"}

def mycombat_topic(seed):
    topics = load_mycombat_topics()
    random.seed(seed)
    t = topics[seed % len(topics)]
    return {"slug": "blog-" + t[1].replace(" ", "-") + "-" + str(seed) + ".html",
            "title": t[0], "primary_kw": t[1], "audience": t[2], "pain": t[3],
            "use_case": t[1], "app": "mycombat"}

def topic(seed):
    day_num = int(datetime.now().strftime("%Y%m%d"))
    return phg_topic(seed) if day_num % 2 == 0 else mycombat_topic(seed)

def clean_body(body):
    body = re.sub(r'<!DOCTYPE[^>]*>', '', body, flags=re.I)
    body = re.sub(r'<html[^>]*>', '', body, flags=re.I)
    body = re.sub(r'</html>', '', body, flags=re.I)
    body = re.sub(r'<head[^>]*>.*?</head>', '', body, flags=re.S)
    body = re.sub(r'<body[^>]*>', '', body, flags=re.I)
    body = re.sub(r'</body>', '', body, flags=re.I)
    return body.strip()

def generate_content(topic):
    import urllib.request
    key = os.environ.get("MINIMAX_API_KEY", os.environ.get("NVIDIA_API_KEY", ""))
    url = os.environ.get("MINIMAX_BASE_URL", "https://api.minimax.io/v1")
    app = APPS[topic["app"]]
    
    if not key:
        print("WARNING: No NVIDIA_API_KEY - using fallback content")
        return fallback_content(topic)
    
    app_niche = "AI productivity" if topic["app"] == "phg" else "martial arts training"
    niche_target = "AI tools" if topic["app"] == "phg" else "martial arts"
    
    prompt = BLOG_MASTER_PROMPT.format(
        app_name=app["name"], app_niche=app_niche, title=topic["title"],
        primary_kw=topic["primary_kw"], audience=topic["audience"], pain=topic["pain"],
        author=app["author"], author_title=app["author_title"],
        extension_url=app["extension_url"], app_description=app["description"],
        niche_target=niche_target,
    )
    
    try:
        req = urllib.request.Request(
            url + "/chat/completions",
            data=json.dumps({"model": "MiniMax-M2.7",
                             "messages": [{"role": "user", "content": prompt}],
                             "max_tokens": 3000, "temperature": 0.85}).encode(),
            headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
            method="POST")
        with urllib.request.urlopen(req, timeout=180) as resp:
            c = json.loads(resp.read().decode("utf-8")).get("choices", [{}])[0].get("message", {}).get("content", "")
            if c and len(c) > 200:
                wc = len(c.split())
                print(f"Generated: {len(c)} chars, ~{wc} words")
                if wc < 600:
                    print("WARNING: Low word count")
                return clean_body(c)
    except Exception as e:
        print(f"API Error: {e} - using fallback")
    
    return fallback_content(topic)

def fallback_content(topic):
    app = APPS[topic["app"]]
    kw, a, e, s = topic["primary_kw"], topic["audience"], app["extension_url"], app["short"]
    niche = "AI productivity" if topic["app"] == "phg" else "martial arts training"
    return (
        "<h1>" + topic["title"] + "</h1>"
        "<p class=\"lead\">" + kw.title() + " matters for " + a + ". Here's how to get the most out of " + s + ".</p>"
        "<h2>Introduction</h2>"
        "<p>" + kw.title() + " is essential for " + a + ". This guide shows how " + s + " helps you get better results.</p>"
        "<h2>Why This Matters</h2><p>Structured approaches deliver better results.</p>"
        "<h2>Common Mistakes</h2><ul><li>Skipping the basics</li><li>Not using available features</li></ul>"
        "<h2>FAQ</h2>"
        "<div class=\"faq-item\"><h3>Is " + s + " free?</h3><p>Yes.</p></div>"
        "<div class=\"faq-item\"><h3>What does it do?</h3><p>" + app["description"] + "</p></div>"
        "<h2>Get Started</h2><p><a href=\"" + e + "\">" + app["cta"] + "</a></p>"
    )

def generate_title(topic, body):
    import urllib.request
    key = os.environ.get("MINIMAX_API_KEY", os.environ.get("NVIDIA_API_KEY", ""))
    url = os.environ.get("MINIMAX_BASE_URL", "https://api.minimax.io/v1")
    if not key:
        return fallback_title(topic)
    prompt = f"One SEO title, 8-12 words, primary keyword '{topic['primary_kw']}' included. Title only:"
    try:
        req = urllib.request.Request(
            url + "/chat/completions",
            data=json.dumps({"model": "MiniMax-M2.7",
                             "messages": [{"role": "user", "content": prompt}],
                             "max_tokens": 60, "temperature": 0.9}).encode(),
            headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
            method="POST")
        with urllib.request.urlopen(req, timeout=60) as resp:
            t = json.loads(resp.read().decode("utf-8")).get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            t = re.sub(r"^Title:", "", t).strip()
            if t and len(t) > 10 and '<h1' not in t and 'SEO title' not in t and 'Title:' not in t and 'Word count' not in t:
                return t
    except:
        pass
    return fallback_title(topic)

def fallback_title(topic):
    kw = topic["primary_kw"]
    s = APPS[topic["app"]]["short"]
    return "Why " + kw.title() + " Gets Ignored (" + s + " Fixes It)"

def jsonld_script(json_str):
    safe = json_str.replace("</script>", "<\/script>")
    return "<script type='application/ld+json'>" + safe + "<" + "/script>"

def build_html(topic, body, related=None, today=None):
    if today is None:
        today = date.today().isoformat()
    slug = topic["slug"]
    url = "https://" + SITE_DOMAIN + "/" + slug
    year = datetime.now().year
    app = APPS[topic["app"]]

    meta_desc = topic["primary_kw"] + " - " + app["description"]
    m = re.search(r"<p[^>]*class=\"article-lead\"[^>]*>.*?<p>([^<]+)</p>", body, re.S)
    if m:
        meta_desc = m.group(1)[:155]

    article_json = json.dumps({
        "@context": "https://schema.org", "@type": "Article",
        "headline": topic["title"], "description": meta_desc,
        "image": app["logo"], "datePublished": today + "T00:00:00+00:00",
        "author": {"@type": "Person", "name": app["author"]}
    }, ensure_ascii=False)

    faq_json = json.dumps({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": "Is " + app["short"] + " free?",
             "acceptedAnswer": {"@type": "Answer", "text": "Yes, " + app["short"] + " is completely free to download and use."}},
            {"@type": "Question", "name": "What does " + app["short"] + " do?",
             "acceptedAnswer": {"@type": "Answer", "text": app["description"]}},
            {"@type": "Question", "name": "How do I get started?",
             "acceptedAnswer": {"@type": "Answer", "text": "Download " + app["short"] + " free and start using it in seconds."}}
        ]
    }, ensure_ascii=False)

    breadcrumb_json = json.dumps({
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://" + SITE_DOMAIN + "/"},
            {"@type": "ListItem", "position": 2, "name": "Apps", "item": "https://" + SITE_DOMAIN + "/index.html"},
            {"@type": "ListItem", "position": 3, "name": topic["title"], "item": url}
        ]
    }, ensure_ascii=False)

    rel_html = ""
    if related:
        rel_html = "<div class=\'related-posts\'><h2>More Guides</h2><ul>"
        for p in related:
            rel_html += "<li><a href=\'" + p["url"] + "\'>" + p["title"] + "</a></li>"
        rel_html += "</ul></div>"

    sticky_bar = (
        "<div class=\"sticky-cta-bar\">" +
        "<div class=\"sticky-cta-inner\">" +
        "<div class=\"sticky-cta-text\">" +
        "<span class=\"sticky-cta-label\">Free Download</span>" +
        "<span class=\"sticky-cta-name\">" + app["name"] + "</span>" +
        "</div>" +
        "<a href=\"" + app["extension_url"] + "\" class=\"sticky-cta-btn\">" + app["cta"] + "</a>" +
        "</div></div>"
    )

    head = (
        "<head>"
        "<meta charset=\'UTF-8\'>"
        "<meta name=\'viewport\' content=\'width=device-width,initial-scale=1.0\'>"
        "<title>" + topic["title"] + " | " + app["name"] + "</title>"
        "<meta name=\'description\' content=\"" + html_mod.escape(meta_desc) + "\">"
        "<meta name=\'robots\' content=\'index,follow\'>"
        "<link rel=\'canonical\' href=\"" + url + "\">"
        "<meta property=\'og:type\' content=\'article\'>"
        "<meta property=\'og:url\' content=\"" + url + "\">"
        "<meta property=\'og:title\' content=\"" + html_mod.escape(topic["title"]) + "\">"
        "<meta property=\'og:description\' content=\"" + html_mod.escape(meta_desc) + "\">"
        "<meta property=\'og:image\' content=\"" + app["logo"] + "\">"
        "<link rel=\'stylesheet\' href=\'style.css\'>"
        + jsonld_script(article_json)
        + jsonld_script(faq_json)
        + jsonld_script(breadcrumb_json)
        + "<script async src=\'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9842825734923539\'></script>"
        + "<script async src=\'https://www.googletagmanager.com/gtag/js?id=G-FDZR5XWWBM\'></script>"
        + "<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag(\'js\',new Date());gtag(\'config\',\'G-FDZR5XWWBM\');</script>"
        + "</head>"
    )

    page = (
        "<!DOCTYPE html><html lang=\'en\'>" + head + "<body>"
        "<header class=\'article-header\'><div class=\'container\'>"
        "<nav class=\'breadcrumb\'><a href=\'/\'>Home</a> / <a href=\'index.html\'>Apps</a> / <span>" + html_mod.escape(topic["title"][:40]) + "</span></nav>"
        "</div></header>"
        "<main class=\'article-main\'><div class=\'container\'>"
        + body + rel_html
        + "</div></main>"
        "<footer class=\'article-site-footer\'><div class=\'container\'><p>&copy; " + str(year) + " Gamified Living Apps.</p></div></footer>"
        + sticky_bar +
        "<script src=\'script.js\' defer></script>"
        "</body></html>"
    )
    return page


def sitemap_add(existing, slug, today):
    return existing.replace("</urlset>",
        "  <url>\n    <loc>https://" + SITE_DOMAIN + "/" + slug + "</loc>\n"
        "    <lastmod>" + today + "</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n</urlset>")

def main():
    state = get_state()
    today = date.today().isoformat()
    day_num = int(datetime.now().strftime("%Y%m%d"))
    app_name = "PHG" if day_num % 2 == 0 else "MyCombat"
    
    if today in state.get("posted_today", []):
        print("Already posted today (" + app_name + ")")
        return
    
    seed = int(datetime.now().strftime("%Y%m%d"))
    tpc = topic(seed)
    slug = tpc["slug"]
    
    if slug in state.get("posted_blogs", []):
        print("Already posted: " + slug)
        return
    
    print("Generating for " + app_name + ": " + tpc["title"] + "...")
    
    body = generate_content(tpc)
    tpc["title"] = generate_title(tpc, body)
    print("Title:", tpc["title"])
    
    rel = get_related(slug)
    page = build_html(tpc, body, rel, today)
    
    sm, sha = get_file("sitemap.xml")
    print("Uploading...")
    upd_file(slug, page, "Auto-blog: " + tpc["title"] + " (" + today + ")")
    print("Updating sitemap...")
    upd_file("sitemap.xml", sitemap_add(sm, slug, today), "Auto-sitemap: add " + slug, sha)
    
    state.setdefault("posted_blogs", []).append(slug)
    state.setdefault("posted_today", []).append(today)
    state["posted_blogs"] = state["posted_blogs"][-100:]
    save_state(state)
    print("DONE! https://" + SITE_DOMAIN + "/" + slug)

if __name__ == "__main__":
    main()
