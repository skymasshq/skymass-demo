import { SkyMass } from "@skymass/skymass";
import admin from "firebase-admin";

// NOTE: this entire script runs exclusively on the server.  The UI is provided by SkyMass.

const firebase = admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env["FIREBASE_CERT_JSON"])
  ),
  databaseURL: process.env["FIREBASE_RTDB_URL"],
});

// utility function to return a firebase reference
// to the user's todos and optionally a specific todo id
function dbRef(email, id) {
  const emailEsc = email.replace(/[.#$/[\]]/g, "_");
  return firebase.database().ref("todos/" + emailEsc + (id ? "/" + id : ""));
}

// create a SkyMass instance
const sm = new SkyMass({ key: process.env["SKYMASS_KEY"] });

// register the application
sm.page("/firebase-todolist", async (ui) => {
  // This function is run on first app access and every time something
  // significant happens in the UI (for example when a button is pressed,
  // a table row is selected, ...)

  // SkyMass uses Markdown to emit and format text.
  // Here we emit a level 1 (#) header
  ui.md`# ☑️ Firebase Todo List`;

  // This app is configured at skymass.dev to require a login
  // so user will always be set to { email: ... }
  const { email } = ui.user();

  // Firebase Real Time DB let's us subscribe to update events.
  // Let's create a subscription using ui.subscribe()
  const UserTodoList = ui.subscribe(
    "todos_subscription",
    (update) => {
      const userTodos = dbRef(email);
      const handler = (snapshot) => {
        const val = snapshot.val() || {};
        // convert Firebase object to an array
        const list = Object.keys(val).map((id) => {
          const todo = val[id];
          todo.id = id;
          todo.due_by = new Date(todo.due_by);
          return todo;
        });
        // call update with the latest todo list
        update(list);
      };
      userTodos.on("value", handler);
      // return a cleanup function
      return () => userTodos.off("value", handler);
    },
    []
  );

  // SkyMass Markdown supports mentioning widgets using {widget_id} to
  // control their placement. {widgets} on the same line results in laying
  //  the out in a single row with equal with cols.  "~" means an empty column.
  // In this case, we are rendering {todos} followed by two empty cols
  // which means todos will occupy 1/3 of the available row width.
  ui.md`{todos} ~ ~`;

  // Render table with the items returned from the query
  // Note that UserTodoListObservable is an RxJS Observable!
  // ui.table will automatically re-render every time the Observable's value is updated.
  // The optional columns prop specifies col rendering options.
  const table = ui.table("todos", UserTodoList, {
    loading: "Loading Todos from Firebase",
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
  const toggle = ui.button("toggle", {
    label: todo ? (todo.done ? "Mark as Todo" : "Mark as Done") : "Toggle",
    disabled: !todo,
  });
  // .didClick toggles true when the button is clicked causing
  // this code block to be entered once per button click
  if (toggle.didClick) {
    await dbRef(email, todo.id).update({ done: !todo.done });
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
      dbRef(email, todo.id).remove();
      ui.toast("Deleted");
    }
  }

  const add = ui.button("add", { label: "New Todo" });
  if (add.didClick) {
    // Similar to ui.confirm, ui.modal returns a Promise that we await
    // until the modal is closed. Modals accept a function that controls
    //  what happens inside of them, similar to the top level app. This
    // function runs independently while the parent function is 'awaiting'
    // the completion of the modal.
    await ui.modal("add", async (ui) => {
      ui.md`#### New Todo`;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // forms are used to group related inputs together.
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
        const { title, due_by } = newTodo.val;
        await dbRef(email).push().set({
          title,
          due_by: due_by.toISOString(), // store dates as a serializable format
          done: false,
        });
        ui.toast("Added new todo");
        ui.close();
      }
    });
  }

  // link to this file
  ui.md`[View Source on GitHub](https://github.com/skymasshq/skymass-demo/blob/main/firebase_todolist.mjs)`;
});
