import { SkyMass } from "@skymass/skymass";
import pgPromise from "pg-promise";

// open a db connection to Neon
const pgp = pgPromise({});
const db = pgp(process.env["NEON_DSN"]);

// create a SkyMass instance
const sm = new SkyMass({ key: process.env["SKYMASS_KEY"] });

// register the application
sm.page("/neon-todolist", async (ui) => {
  // This function is run repeatably everytime something signficant
  // happens in the UI (for example a button is pressed).

  // SkyMass uses markdown to emit and format text.
  // here we emit a level 1 (#) header
  ui.md`# ☑️ Todo List`;

  // this app is configured at skymass.dev to require a login
  // user = { email: ... };
  const user = ui.user();

  // a checkbox to control whether we include completed todos
  const hideDone = ui.boolean("hide_done", { label: "Hide Completed Todos" });

  // SELECT user's todos from the database.
  // note that todos is a Promise.  SkyMass widgets handle literal and async results for you
  const todos = db.any(
    "SELECT id, title, due_by, done FROM todos WHERE created_by = $(email)" +
      (hideDone.val ? " AND done = true" : ""),
    { email: user.email }
  );

  // SkyMass markdown also let's us mention widgets using their id {widget_id}
  // {widgets} on the same line results in laying the out in a single row as equal cols.
  // "~" means an empty column.  In this case, we are rendering {todos} followed by two empty cols
  // which means todos will occupy 1/3 of the available row width.
  ui.md`{todos} ~ ~`;

  // renders a table with the items returned from the query
  // the columns prop let's use customize the rendering of each column
  const table = ui.table("todos", todos, {
    loading: "Loading Todos...",
    empty: "No Pending Todos",
    columns: {
      "*": { search: false },
      id: { hidden: true, isId: true },
      title: { label: "Todo", format: "multiline" },
      due_by: { label: "Due By", format: "date_short" },
      done: { label: "Done", type: "boolean" },
    },
  });

  // table widgets have a .selection field which contains the currently selected row
  // destructuring it into [todo] means todo is the currently selected row or null if no row is selectged.
  const [todo] = table.selection;

  // render a button to mark the selected todo as done/todo.
  const toggle = ui.button("toggle", {
    label: todo ? (todo.done ? "Mark as Todo" : "Mark as Done") : "Update",
    disabled: !todo,
  });
  // .didClick becomes true when the button is clicked so this code block gets executed
  if (toggle.didClick) {
    // note: we can await async operations
    await db.none("UPDATE todos SET done = NOT done WHERE id = $(id)", {
      id: todo.id,
    });
    ui.toast(todo.done ? "Marked as todo" : "Marked as done");
  }

  // similar to toggle above
  const del = ui.button("delete", {
    label: "Delete",
    disabled: !todo,
  });
  if (del.didClick) {
    // modal interactions, like ui.confirm, return Promises which we await!
    if (await ui.confirm({ text: "Are you sure?" })) {
      await db.none("DELETE FROM todos WHERE id = $(id)", {
        id: todo.id,
      });
      ui.toast("Deleted");
    }
  }

  const add = ui.button("add", { label: "New Todo" });
  if (add.didClick) {
    // similar to ui.confirm, ui.modal returns a Promise that we await until the modal is closed.
    // modals accept a function that controls what happens inside of them, similar to the top level app. 
    // this function runs independently of the parent while the parent function is 'awaiting' the 
    // completion of the modal.
    await ui.modal("add", async (ui) => {
      ui.md`#### New Todo`;

      // forms are used to group related inputs together.
      const todo = ui.form("todo", {
        fields: {
          title: ui.string("title", { placeholder: "Title", required: true }),
          due_by: ui.date("due_by", { required: true, min: new Date() }),
        },
        action: ui.button("add", { label: "Add" }),
      });

      // similar to button .didClick, .didSubmit becomes true when the form is submitted
      if (todo.didSubmit) {
        await db.none(
          `
          INSERT INTO todos 
            (title, due_by, created_by) 
          VALUES 
            ($(title), $(due_by), $(created_by))`,
          {
            ...todo.val,
            created_by: user.email,
          }
        );
        ui.toast("Added new todo");
        ui.close();
      }
    });
  }
});
