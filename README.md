# Narrative Builder

A mad-lib and rubric builder for student narratives (reading, writing, class participation; under 200 words), saving to a Google Doc through Apps Script and filling Veracross through a bookmarklet. Use it at **https://jakegoldwasser.github.io/narrative-builder/** (GitHub Pages). There it saves in the browser only; the Google Doc copy (below) saves to the doc.

Files: `src/index.html` (edit this), `index.html` (built by `node build.js`, which puts `veracross-filler.js` in as the bookmarklet; paste it into Apps Script as `Index`), `Code.gs` (Apps Script), `veracross-filler.js`.

## Setup (about 5 minutes, one time)

## 1. Connect it to your Google Doc
1. Create a new Google Doc for this term's narratives (for example, "Narratives – Fall 2026").
2. In the doc, go to **Extensions → Apps Script**.
3. Delete what's in `Code.gs` and paste in the contents of **Code.gs**.
4. Click **＋ → HTML**, name the file `Index` (no extension), and paste in the contents of **index.html** from this repository.
5. Click **Save** 💾 and close the Apps Script tab.
6. Reload the doc. A **Narratives** menu appears. Choose **Narratives → Open Narrative Builder**.
7. The first time, Google asks you to authorize the script. Choose your account, then **Advanced → Go to (project) → Allow**. It's your own script: it only touches this doc, and it fetches the builder's latest version from GitHub Pages ("connect to an external service").

**Where your work is kept, and why it can't be lost:** in the doc version, everything is saved to a file in your Google Drive, `Narrative Builder data.json`, in a folder called **Narrative Builder data** beside the doc, so the builder on any computer shows the same students.
- **Backups:** every hour you work, and always just before a student is removed or a backup restored, a full copy goes into that folder's **Backups** folder (up to 500; older ones go to Drive's trash, which keeps them 30 more days). To use one, open it, copy its text, and paste it into **Backup → Restore from pasted**. Drive also keeps earlier versions of the data file itself.
- **Removing a student never deletes them:** they go to **Recently removed** (at the foot of the student list), where **Put back** returns them with everything you wrote. Restoring a backup sets the current students aside there too.
- **Undo:** **Clear sheet** and **Back to builder** (which now takes two clicks) both offer Undo for 12 seconds.
- **Two windows at once:** a student is saved only over the copy that window started from. If another window changed that student meanwhile, its copy is kept and this window's version goes to Recently removed as "(version from another window)", so neither edit is lost. A student leaves the list only by Remove student. Saved wordings from both windows are kept. A window that comes back into use (or every minute) loads what the other one saved.
- **If loading fails,** the builder says so and saves nothing, rather than opening empty.
- **Before November 2026** work was kept in the script's own storage, which holds only about 75 students; it's copied into the Drive file the first time, and the old copy is left as it was.

**Updates arrive on their own.** Each time you open the builder from the doc, it loads its latest version from GitHub Pages, so you never paste in `index.html` again (the `Index` file is only used if GitHub can't be reached). Only a change to `Code.gs` needs pasting in.

**Moving work from the GitHub Pages site into the doc:** the two keep separate copies. On the site, click **Backup → Copy**; in the doc's builder, click **Backup**, paste, and click **Restore from pasted** (this replaces what's in the doc's builder).

Every change saves automatically, about 2 seconds after you stop typing (the top bar reads "Saved to Google Doc · 8:42 AM", and **Open the Google Doc ↗** beside it opens the doc in a new tab). Earlier versions of the doc are in its **File › Version history**. The doc is rewritten each time with every student's heading, narrative and word count. Make your edits in the builder: anything typed directly into the doc gets overwritten.

**Optional, for a full browser tab instead of a pop-up window:** in Apps Script choose **Deploy → New deployment → Web app**. Set Execute as **Me** and Who has access **Only myself**, then bookmark the URL. Open the builder from the doc menu once first so it knows which doc to use.

## 2. Add students
Copy the name column from your Google Sheet, plus the grade and pronoun columns if you have them. Click **Paste roster**. The tool:
- detects header rows and grade/pronoun columns, and accepts "Last, First"
- for separate first and last name columns, lets you say which order they're in
- shows a preview, and skips names that are already in the list
- with no pronoun column, starts from a guess based on the first name (very common names only; anything else, like Jordan or Sam, gets they/them). Each guess is marked in the student list ("he?") and beside Pronouns (**Guess · confirm**) until you click Confirm or choose pronouns yourself, and Send to Veracross lists any still unconfirmed

## 3. Write
- **Only what you mark goes in.** Each rubric row you mark (Exceptionally well / Proficient / Room for growth) adds its own sentence, in the order of the rows; its dropdown swaps the wording, offers next steps, or lets you write your own. A row you don't mark, a dropdown left on “— leave out —” and an empty box add nothing. A sentence you picked or wrote yourself stays put if you change that row's level.
- **Edit any answer:** **✎ Edit** beside a sentence (or "✎ edit this wording…" in its dropdown) opens it with its words as they read now. When you click away or press **Save wording**, your version is kept for the whole class: listed first under "Your wording" in that dropdown, with the student's name and pronouns swapped for each student, and used first for students you mark at that level (or add that goal for, or for the Closing) from then on. If other students already have the wording you replaced, a **Change them too** button (for 12 seconds) gives them your new one as well. **Remove from list** stops offering one. If a pronoun can't be worked out, that student keeps exactly what you typed.
- **Reorder sentences:** **⇅ Reorder** under the narrative lists its sentences as cards; drag one (or use its ▲ ▼) to move it. The order is this student's only, never carried to others; sentences are joined up again in their new order, a newly marked one goes after the sentence it usually follows, and **Back to the usual order** undoes it. Not available while a narrative is edited by hand.
- **No "As a reader, she reads":** "As a reader," / "As a writer," / "In class," are left off when the first sentence already says read, write or class.
- **Clearing:** every question has a × (or “— leave out —”), and **Clear sheet** (click twice) clears everything for the student.
- **Too long?** Past 200 words the meter turns red and a note says how far over; nothing is ever cut for you.
- **Sections:** Opening, Class Participation, Reading, Writing, Student Writing (grade 9), To Work On and Closing. The Student Writing quote starts on “Their submission to the Writing Quarterly included this line:” (shown with “…” until you paste the line in), and the Closing on “I look forward to seeing her continued growth as a reader and writer.” (choose another, or “— leave out —”); a sheet with only that isn’t counted as started.
- **Paragraphs:** between each two sections, **Same paragraph / New paragraph** says whether the second starts a new paragraph. It's one setting for the whole class (by default Student Writing and To Work On start new paragraphs).
- **Link sentences** (top bar, on by default) joins a section's sentences in pairs with punctuation and conjunctions, never by adding words to them: two strengths with ", and"; a strength and a goal with ", but", or once a section "While she…, she would benefit from…"; two goals of the same kind as one ("would benefit from A and from B"); a text's reading with a semicolon. Sentences you wrote yourself are never changed.
- **To Work On:** click **+ Add** on any goal (side conversations, active listening, intellectual risks, speaking more or less, bolder arguments, annotation, punctuality, preparation, time management, notes, evidence, revision, proofreading, group work, the Academic Center, student hours); each has two wordings or your own. Two short goals share a sentence: "Going forward, Maya would benefit from A and from B.", then "I encourage her to focus on…", "I hope to see her prioritize…", with "Finally," on the last of three or more.
- Each blank is a dropdown of phrases based on your Class Participation Rubric, your FLE rubrics and the English 9 syllabus. Choose **✎ write my own…** to type your own words, or **— leave out —** to drop an optional sentence.
- Each section has a box at the bottom for adding your own sentence.
- **Grade 9:** the Writing section has a bar where you can quote a line of the student's writing or name the subject of a creative piece (poem, personal essay, short story…).
- Changing the name, grade or pronouns updates the whole narrative, including verbs ("she brings" / "they bring").
- The word meter turns red past 200. Roster dots: grey = not started, amber = has blanks, green = finished, red = over 200 words.
- The narrative on the right is always editable: just click and type for final polishing (the choices are then set aside). Use **Back to builder** to throw away the hand edits and return to the dropdowns.

## 4. Send to Veracross
1. Click **Send to Veracross**. The first time, drag the **Fill Veracross** button to your bookmarks bar.
2. Click **Copy narratives**.
3. In Veracross, open the comment-entry page for the class and click the **Fill Veracross** bookmark. It finds each student's comment box by name, fills it in and outlines it in green. It also lists any students it couldn't match.
4. Look the comments over, then click **Save** in Veracross.

The filler doesn't press Save for you. If you want it to, open `veracross-filler.js`, set `AUTO_SAVE = true`, and paste the file into the browser console (or rebuild the bookmarklet).
