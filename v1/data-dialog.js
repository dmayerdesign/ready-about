import { animations } from "./animations.js";

/**
 * A general-purpose component for displaying a dialog, usually to collect some user input.
 */
export class DataDialog {
  dialogElem;
  contentElem;
  closeButtonElem;

  render() {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div id="data-dialog" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); z-index: 9999;">
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: #fff; padding: 20px; border-radius: 5px; max-width: 80%; max-height: 80%; overflow-y: auto;">
            <h2>Game State Data</h2>
            <pre id="data-dialog-content" style="white-space: pre-wrap;"></pre>
            <button id="data-dialog-close" style="margin-top: 10px;">Close</button>
          </div>
        </div>
      `,
    );

    this.dialogElem = document.getElementById("data-dialog");
    this.contentElem = document.getElementById("data-dialog-content");
    this.closeButtonElem = document.getElementById("data-dialog-close");
    this.closeButtonElem.addEventListener("click", () => {
      // Remove dialogElem from the DOM, sans animation
      this.dialogElem.remove();
    });
  }
}
