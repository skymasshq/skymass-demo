import { SkyMass } from "@skymass/skymass";
import { createClient } from "@supabase/supabase-js";

// NOTE: this entire script runs exclusively on the server.  The UI is provided by SkyMass.

// Create a single Supabase client for interacting with your database
const supabase = createClient(
  process.env["SUPABASE_URL"],
  process.env["SUPABASE_KEY"]
);

// create a SkyMass instance
const sm = new SkyMass({ key: process.env["SKYMASS_KEY"] });

// register the application
sm.page("/supabase-todolist", async (ui) => {
  // This function is run on first app access and every time something
  // significant happens in the UI (for example when a button is pressed,
  // a table row is selected, ...)

  // SkyMass uses Markdown to emit and format text.
  // Here we emit a level 1 (#) header
  ui.md`# ☑️ Supabase Todo List`;

  // This app is configured at skymass.dev to require a login
  // so user will always be set to { email: ... }
  const { email } = ui.user();

  // A checkbox input to control whether we hide completed todos
  const hideDone = ui.boolean("hide_done", { label: "Hide Completed Todos" });

  // when hideDone is checked, doneFilter filters for todos whose done = false
  const doneFilter = hideDone.val ? { done: false } : {};

  // SELECT user's todos from the database. supabase.select returns a Promise.
  const todosPromise = supabase
    .from("todo")
    .select("id,title,due_by,done")
    .match({ created_by: email, ...doneFilter })
    .then(({ data }) => {
      data.forEach((todo) => {
        todo.due_by = new Date(todo.due_by);
      });
      return data;
    });

  // SkyMass Markdown supports mentioning widgets using {widget_id} to
  // control their placement. {widgets} on the same line are laid out in
  // a single row with equal width cols.
  // "~" means an empty column. In this case, we are rendering
  //      `{todos} ~ ~`
  // which means todos will occupy 1/3 of the available row width.
  ui.md`{todos} ~ ~`;

  // Render table with the items returned from the query
  // Note that 'todosPromise', which contains the list of todos is a Promise.
  // ui.table automatically handles literals or Promises.
  // The optional columns prop specifies col rendering options.
  const table = ui.table("todos", todosPromise, {
    loading: "Loading Todos...",
    empty: "No Pending Todos.  Use 'New Todo' to add some.",
    columns: {
      "*": { search: false },
      id: { hidden: true, isId: true },
      title: { label: "Todo", format: "multiline" },
      due_by: { label: "Due By", format: "date_short" },
      done: { label: "Done" },
    },
  });

  // Table widgets have a .selection field containing an array of
  // currently selected rows.  Destructuring it into [todo] means
  // todo is the currently selected row or null if no row is selected.
  const [todo] = table.selection;

  // render a button to mark the selected todo as done/todo.
  // button is disabled unless a table row is selected
  const toggle = ui.button("toggle", {
    label: todo ? (todo.done ? "Mark as Todo" : "Mark as Done") : "Toggle",
    disabled: !todo,
  });
  // .didClick toggles true when the button is clicked causing
  // this code block to be entered on button clicks
  if (toggle.didClick) {
    // note: we can await async operations
    await supabase
      .from("todo")
      .update({ done: !todo.done })
      .match({ id: todo.id });
    ui.toast(todo.done ? "Marked as todo" : "Marked as done");
  }

  // similar to toggle above
  const del = ui.button("delete", {
    label: "Delete",
    disabled: !todo,
  });
  if (del.didClick) {
    // modal interactions, like ui.confirm, return Promises which we await!
    // ui.confirm returns a Promise that resolves to true / false
    if (await ui.confirm({ text: "Are you sure?" })) {
      await supabase.from("todo").delete().match({ id: todo.id });
      ui.toast("Deleted");
    }
  }

  const add = ui.button("add", { label: "New Todo" });
  if (add.didClick) {
    // Similar to ui.confirm, ui.modal returns a Promise that we await
    // until the modal is closed. Modals accept a function that controls
    // what happens inside of them, similar to the top level app. This
    // function runs independently while the parent function is 'awaiting'
    // the completion of the modal.
    await ui.modal("add", async (ui) => {
      ui.md`#### New Todo`;

      // default due by date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // forms are used to group related inputs together.
      // here we have two fields: title and due_by and the 'Add' button.
      const newTodo = ui.form("todo", {
        fields: {
          title: ui.string("title", { placeholder: "Title", required: true }),
          due_by: ui.date("due_by", {
            required: true,
            min: new Date(),
            defaultVal: tomorrow,
          }),
        },
        action: ui.button("add", { label: "Add" }),
      });

      // similar to button .didClick, .didSubmit toggles true when the form is submitted
      // newTodo.val will contain { title: ..., due_by: ...}
      if (newTodo.didSubmit) {
        await supabase
          .from("todo")
          .insert([{ ...newTodo.val, created_by: email }]);
        ui.toast("Added new todo");
        ui.close();
      }
    });
  }

  // link to this file
  ui.md`[View Source on GitHub](https://github.com/skymasshq/skymass-demo/blob/main/supabase_todolist.mjs)`;
});
