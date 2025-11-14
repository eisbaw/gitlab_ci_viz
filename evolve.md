Read PRD.md.
You are an expert in usability and web-design, but also care about high quality data visualiztion.

We shall do evolution, using two primitives:
1. Evaluate visually the current solution at git HEAD.
2. Pick new HEAD from prior commits and generate new mutation.
... and repeat these two operations forever.



These are explained better below:

# Step 1: Assign a score
Make sure all files are commited on HEAD before we produce new commits - i.e. the fan-out.
Once we have committed all files, we are to evaluate this HEAD to give it a score from 0.00 (bad) to 100.00 (perfect).
Perfect score of 100.00 means that we have very high information density and very little whitespace, that the page is clearly laid out, logical and consistent, with no glitches or errors.
Score of 30 means we do show pipelines and jobs, but lots of whitespace.
Score of 10 means we do not show useful information by default.

To evaluate kill prior server running, if any, on port 8000. Then spin up via 'just run'. Use Chrome MCP server to load localhost:8000, wait for 20 sec, take screenshot.
Read screenshot visually, review it for metrics: Clarity, Density, Clutter - and give a combined score.
Use a sub-agent to interact with the MCP server. Use another sub-agent to review the screenshot.
Set a tag on the HEAD commit of name format <combined-score>-<commit-sha>.
(We include the commit-sha in the tag name to prevent clobbering of same-scores).

# Step 2: Mutate from prior top-3
Look at git tags which follow naming of <combined-score->-<commit-sha>. Sort by score, then pick randomly among the top-3 highest scoring tags.
The picked tag, is checked out -- detached HEAD is OK.
This becomes our new HEAD.

We then proceed to make a change, big or small, to improve UX. Use a sub-agent for making the UX change.
git commit the change, giving us a new HEAD commit.

Proceed to Step 1 to evaluate this new commit.
Thus step 1 and 2 form an evolutionary feedback loop.

# Help
If the scores do not increase, it may help to go back to the baseline tag, "baseline".

