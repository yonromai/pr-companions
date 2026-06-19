Corrected version:

The [https://github.com/yonromai/pr-companions](https://github.com/yonromai/pr-companions) repo is designed to host small "PR companion" websites, intended to help humans review agent-generated PRs.

Each companion website is composed of two pages:

* index.html: The main page designed to be maximally clear and pedagogical for human readers
* support.html: A page containing support references (e.g. pointers to documentation, code, research papers, ...) that would allow a human to audit/verify the claims made in index.html. Support elements will typically consist of HTTP link(s) and direct, unaltered quotes from the source. The main goals of the support page are comprehensive coverage and rigor (e.g. rather than clarity and approachability).

## Authoring

The companion websites are authored by coding agents, by looking at an existing code change (typically authored by a coding agent). They are typically built iteratively by having the human ask questions to the agent and refine the content of the companion website.

If there is no existing companion website for a code change, the agent will typically:

1. Ask the human a series of questions that will help it design a companion website that the user is happy with
2. Present the human with a plan that will only be executed after the human has signed off on it

## Content guidelines

The content should be pedagogic enough to be understood by a smart high schooler.

An index page will typically contain at least the following sections:

* Context: Prerequisite context that the reviewers should be familiar with in order to effectively review the PR. This context can be external or internal to the libraries being PR'd.
* Review guidelines: Practical help to review the PR content, e.g. a linear order of the content, parts of the PR to pay particular attention to.

Notes:
* Companion websites are expected to be consumed along with the PR. Consequently, they should avoid repeating content that is already visible in the PR.
* Fully leverage HTML features such as collapsibles, footnotes, and tooltips to allow for optional extra content without compromising clarity and approachability. They effectively make content "on demand" which allows readers to interactively spend time where they need to. This is highly desirable.
* I love representative yet simple examples. Bonus points if examples are consistently evolved over time, providing a comprehension anchor to the readers.
* Paper references will preferably be Arxiv html links (e.g. https://arxiv.org/html/XXX rather than https://arxiv.org/abs/XXX or https://arxiv.org/pdf/XXX)

## Coding languages

The typical website page should include:

* Modern HTML
* Use Tailwind CSS for styling
* For interactive diagrams, use React Flow (e.g. along with Dagre or ELK.js)
* Feel free to embed code diffs from GitHub, or use Shiki plus diff2html.
* For advanced use cases, MDX can be used.
* Use a simple and consistent dark theme only.

## Destination

While the companion page / PR code is still being worked on, the pages can be published to:

* [https://yonromai.github.io/pr-companions/scratch/marin/YYYYMMDD/SLUG/index.html](https://yonromai.github.io/pr-companions/scratch/marin/YYYYMMDD/SLUG/index.html)
* [https://yonromai.github.io/pr-companions/scratch/marin/YYYYMMDD/SLUG/support.html](https://yonromai.github.io/pr-companions/scratch/marin/YYYYMMDD/SLUG/support.html)

Once a PR (e.g. 1234) is open against a repo (e.g. marin), the companion website should be published here:

* [https://yonromai.github.io/pr-companions/marin/pulls/1234/index.html](https://yonromai.github.io/pr-companions/marin/pulls/1234/index.html)
* [https://yonromai.github.io/pr-companions/marin/pulls/1234/support.html](https://yonromai.github.io/pr-companions/marin/pulls/1234/support.html)

Let's note that these pages are 100% authored by coding agents, and therefore can be pushed liberally.
