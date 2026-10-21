/**
 * @jest-environment node
 *
 * `_reusable-claude-mention.yml` — the hook every repo's claude-mention.yml
 * stub calls. One copy of the guard lives here, not in any stub (build.md
 * § Reusable workflows item 5 in the operator); this suite is what makes
 * that safe. The responder it dispatches to (mention.yml in chrisgriffin/ops)
 * pins its own half there, including the ⏳ text both sides agree on.
 */
const { readFileSync } = require("fs")
const { join } = require("path")
const yaml = require("js-yaml")

const WORKFLOW = join(
  __dirname,
  "..",
  ".github",
  "workflows",
  "_reusable-claude-mention.yml",
)
const text = readFileSync(WORKFLOW, "utf8")
const doc = yaml.load(text)
const step = name => text.split(`- name: ${name}`)[1].split("- name:")[0]

const jobsSection = text.split(/\njobs:\n/)[1]
// Sliced to just the `dispatch:` job, not the whole `jobs:` section — a
// second job added later must not be able to satisfy these on its own behalf.
const afterDispatch = jobsSection.split(/^ {2}dispatch:$/m)[1]
const nextJobIdx = afterDispatch.search(/^ {2}[\w-]+:$/m)
const jobBody =
  nextJobIdx === -1 ? afterDispatch : afterDispatch.slice(0, nextJobIdx)
const guard = jobBody.split("\n    steps:")[0]

describe("the dispatch job's guard", () => {
  it("found the dispatch job", () => {
    expect(jobsSection).toMatch(/^ {2}dispatch:$/m)
    expect(jobBody.length).toBeGreaterThan(0)
  })

  it("is job-level, before steps run", () => {
    const ifIdx = jobBody.indexOf("\n    if: ")
    const stepsIdx = jobBody.indexOf("\n    steps:")
    expect(ifIdx).toBeGreaterThan(-1)
    expect(ifIdx).toBeLessThan(stepsIdx)
  })

  it("ignores bot-authored events and cgio-agent, whose replies would loop (ops#155)", () => {
    expect(guard).toContain("github.event.sender.type != 'Bot'")
    expect(guard).toContain("github.event.sender.login != 'cgio-agent'")
  })

  // The caller may be public: a stranger's `@claude` must not post a
  // placeholder or start a run on the operator.
  it("admits only the repo's owner, a member or a collaborator, whichever payload carries the association", () => {
    expect(guard).toContain(
      `contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.comment.author_association || github.event.review.author_association || github.event.issue.author_association)`,
    )
  })

  it("proceeds on an @claude mention, every event kind", () => {
    for (const body of [
      "github.event.comment.body",
      "github.event.review.body",
      "github.event.issue.body",
      "github.event.issue.title",
    ]) {
      expect(guard).toContain(`contains(${body}, '@claude')`)
    }
  })

  it("also proceeds on an owner comment or review, minus empty ones and slash commands (ops#1202)", () => {
    for (const k of ["comment", "review"]) {
      expect(guard).toContain(
        `github.event.${k}.author_association == 'OWNER' && github.event.${k}.body != '' && !startsWith(github.event.${k}.body, '/')`,
      )
    }
  })
})

describe("the detect step", () => {
  const detect = step("Detect a real @claude mention or an owner comment")

  it("repeats the association gate where a reviewer can read it", () => {
    expect(detect).toContain(
      "const allowed = ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(author)",
    )
    expect(detect).toContain(
      "const reply = allowed && (isRealMention(text) || owner)",
    )
  })

  it("skips an owner's empty review and slash commands (the PR loop gate owns /autofix)", () => {
    expect(detect).toContain("author === 'OWNER'")
    expect(detect).toContain("body !== ''")
    expect(detect).toContain("!body.startsWith('/')")
  })

  it("strips code before matching, so a quoted token is not a mention", () => {
    expect(detect).toContain(".replace(/`[^`]*`/g, '')")
    expect(detect).toContain("/(?<![\\w-])@claude(?![\\w-])/i")
  })
})

describe("the placeholder", () => {
  const post = step("Post the placeholder")
  // The responder in chrisgriffin/ops reads a placeholder as pending while
  // its body still starts with this text (ops#1361); the two sides agree
  // on it by this literal.
  const PENDING = "⏳ Seen, working on a reply"

  it("is posted only on a detected reply, with the marker, and its id is dispatched", () => {
    expect(post).toContain("steps.detect.outputs.reply == 'true'")
    expect(post).toContain(`\`${PENDING} to [this]`)
    expect(post).toContain("<!-- reply:placeholder ")
    expect(text).toContain('-f placeholder_id="$PLACEHOLDER_ID"')
    expect(text).not.toContain("content: 'eyes'")
  })

  it("needs both issues and pull-requests write: on a PR thread the comment 403s without the second", () => {
    expect(doc.permissions).toEqual({
      issues: "write",
      "pull-requests": "write",
    })
  })

  it("never cancels a pending run in a burst: concurrency is per event, not per thread", () => {
    expect(doc.concurrency.group).toContain(
      "github.event.comment.id || github.event.review.id",
    )
    expect(doc.concurrency["cancel-in-progress"]).toBe(false)
  })
})

describe("the dispatch to the operator", () => {
  const dispatch = doc.jobs.dispatch.steps.find(
    s => s.name === "Dispatch to the operator",
  )

  it("reads the target and every identifier from env, never interpolated into the shell (ops#1685)", () => {
    expect(dispatch.env.TARGET).toBe("${{ inputs.target }}")
    expect(dispatch.env.GH_TOKEN).toBe(
      "${{ secrets.OPS_GH_TOKEN || secrets.TARGET_TOKEN }}",
    )
    expect(dispatch.run).not.toContain("${{")
    expect(dispatch.run).toContain('-f target="$TARGET"')
  })

  it("carries identifiers only, never the comment text", () => {
    expect(dispatch.run).toMatch(
      /gh workflow run mention\.yml \\\n\s+--repo chrisgriffin\/ops \\\n\s+--ref develop/,
    )
    expect(dispatch.run).not.toMatch(/-f body=|comment\.body/)
  })

  it("fails loud, after the placeholder, when the caller has no dispatch token", () => {
    expect(dispatch.run).toContain('if [ -z "${GH_TOKEN:-}" ]')
    expect(dispatch.run).toContain("exit 1")
  })

  it("the secrets are declared by name: OPS_GH_TOKEN, and TARGET_TOKEN for the operator itself", () => {
    expect(Object.keys(doc.on.workflow_call.secrets).sort()).toEqual([
      "OPS_GH_TOKEN",
      "TARGET_TOKEN",
    ])
  })
})
