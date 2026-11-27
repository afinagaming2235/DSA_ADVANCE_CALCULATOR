
const $ = (id) => document.getElementById(id);

const expressionInput = $("expression");
let calculationHistory = [];

// DISPLAY STATUS
function setStatus(message, isError = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
}

// INSERT TEXT AT CURSOR
function insertAtCursor(value) {
  const start = expressionInput.selectionStart ?? expressionInput.value.length;
  const end = expressionInput.selectionEnd ?? expressionInput.value.length;

  expressionInput.setRangeText(value, start, end, "end");
  expressionInput.focus();
}

// FACTORIAL
function factorial(n) {
  if (!Number.isInteger(n) || n < 0 || n > 170) {
    throw new Error("Factorial requires a whole number from 0 to 170.");
  }

  let result = 1;

  for (let i = 2; i <= n; i++) {
    result *= i;
  }

  return result;
}

// SPLIT FUNCTION ARGUMENTS
function splitArguments(text) {
  const parts = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") {
      depth++;
    } else if (text[i] === ")") {
      depth--;
    } else if (text[i] === "," && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(text.slice(start));

  return parts;
}

// FIND MATCHING CLOSING PARENTHESIS
function findClosingParenthesis(text, openIndex) {
  let depth = 0;

  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "(") {
      depth++;
    } else if (text[i] === ")") {
      depth--;

      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

// PARSE DSA RANGE
function parseRange(text) {
  const match = text.match(
    /^\s*([a-z])\s*=\s*(-?\d+)\s*\.\.\s*(-?\d+)\s*$/i
  );

  if (!match) {
    throw new Error("Use a range like i=1..5.");
  }

  return {
    variable: match[1],
    start: Number(match[2]),
    end: Number(match[3])
  };
}

// DSA OPERATIONS
function evaluateDSA(text, variables) {
  const pattern = /\b(doubleSum|doubleProduct|sum|product)\s*\(/i;

  let match;
  let safety = 0;

  while ((match = pattern.exec(text)) && safety++ < 100) {
    const open = text.indexOf("(", match.index);
    const close = findClosingParenthesis(text, open);

    if (close < 0) {
      throw new Error("Missing closing parenthesis.");
    }

    const name = match[1].toLowerCase();

    const args = splitArguments(
      text.slice(open + 1, close)
    );

    let result;

    // SINGLE SUMMATION OR PRODUCT
    if (name === "sum" || name === "product") {
      if (args.length !== 2) {
        throw new Error(
          name + " needs a range and an expression."
        );
      }

      const range = parseRange(args[0]);

      if (Math.abs(range.end - range.start) > 10000) {
        throw new Error("Range is too large.");
      }

      result = name === "sum" ? 0 : 1;

      const step = range.start <= range.end ? 1 : -1;

      for (
        let i = range.start;
        step > 0 ? i <= range.end : i >= range.end;
        i += step
      ) {
        const value = evaluate(args[1], {
          ...variables,
          [range.variable]: i
        });

        result =
          name === "sum"
            ? result + value
            : result * value;
      }
    }

    // DOUBLE SUMMATION OR PRODUCT
    else {
      if (args.length !== 3) {
        throw new Error(
          name + " needs two ranges and an expression."
        );
      }

      const first = parseRange(args[0]);
      const second = parseRange(args[1]);

      if (
        Math.abs(first.end - first.start) > 1000 ||
        Math.abs(second.end - second.start) > 1000
      ) {
        throw new Error("Range is too large.");
      }

      result = name === "doubleSum" ? 0 : 1;

      const stepA = first.start <= first.end ? 1 : -1;
      const stepB = second.start <= second.end ? 1 : -1;

      for (
        let i = first.start;
        stepA > 0 ? i <= first.end : i >= first.end;
        i += stepA
      ) {
        for (
          let j = second.start;
          stepB > 0 ? j <= second.end : j >= second.end;
          j += stepB
        ) {
          const value = evaluate(args[2], {
            ...variables,
            [first.variable]: i,
            [second.variable]: j
          });

          result =
            name === "doubleSum"
              ? result + value
              : result * value;
        }
      }
    }

    text =
      text.slice(0, match.index) +
      String(result) +
      text.slice(close + 1);
  }

  if (safety >= 100) {
    throw new Error("Too many nested operations.");
  }

  return text;
}

// TOKENIZER
function tokenize(source) {
  const tokens = [];

  const functionNames = [
    "sqrt",
    "cbrt",
    "log2",
    "log",
    "floor",
    "ceil",
    "fact",
    "pow",
    "intdiv"
  ];

  let index = 0;

  while (index < source.length) {
    const remaining = source.slice(index);

    const fn = functionNames.find(name =>
      new RegExp("^" + name + "\\b", "i").test(remaining)
    );

    if (fn) {
      tokens.push({
        type: "function",
        value: fn
      });

      index += fn.length;
      continue;
    }

    const number = remaining.match(
      /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i
    );

    if (number) {
      tokens.push({
        type: "number",
        value: Number(number[0])
      });

      index += number[0].length;
      continue;
    }

    const identifier = remaining.match(/^[a-z_]\w*/i);

    if (identifier) {
      throw new Error(
        "Unknown function or variable: " + identifier[0]
      );
    }

    const char = source[index];

    if ("+-*/%^!(),".includes(char)) {
      tokens.push({
        type: char
      });

      index++;
      continue;
    }

    throw new Error("Invalid character: " + char);
  }

  return tokens;
}

// MAIN EXPRESSION EVALUATOR
function evaluate(source, variables = {}) {
  let text = String(source)
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−]/g, "-")
    .replace(/\s+/g, "");

  if (!text) {
    throw new Error("Please enter an expression.");
  }

  // PROCESS DSA OPERATIONS FIRST
  text = evaluateDSA(text, variables);

  // PROCESS CONSTANTS AND VARIABLES
  text = text.replace(/\bpi\b/gi, "(" + Math.PI + ")");

  text = text.replace(/\be\b/g, "(" + Math.E + ")");

  text = text.replace(/[a-z_]\w*/gi, (identifier) => {
    const key = identifier.toLowerCase();

    const variableKey = Object.keys(variables).find(
      name => name.toLowerCase() === key
    );

    if (variableKey !== undefined) {
      return "(" + variables[variableKey] + ")";
    }

    return identifier;
  });

  const tokens = tokenize(text);
  let position = 0;

  // PRIMARY EXPRESSIONS
  function primary() {
    const token = tokens[position++];

    if (!token) {
      throw new Error("Incomplete expression.");
    }

    if (token.type === "number") {
      return token.value;
    }

    if (token.type === "(") {
      const value = addSub();

      if (
        !tokens[position] ||
        tokens[position++].type !== ")"
      ) {
        throw new Error("Missing closing parenthesis.");
      }

      return value;
    }

    // SCIENTIFIC FUNCTIONS
    if (token.type === "function") {
      if (
        !tokens[position] ||
        tokens[position++].type !== "("
      ) {
        throw new Error(
          token.value + " requires parentheses."
        );
      }

      const first = addSub();

      let second;

      if (
        tokens[position] &&
        tokens[position].type === ","
      ) {
        position++;
        second = addSub();
      }

      if (
        !tokens[position] ||
        tokens[position++].type !== ")"
      ) {
        throw new Error("Missing closing parenthesis.");
      }

      switch (token.value) {
        case "sqrt":
          if (first < 0) {
            throw new Error(
              "Square root input must be non-negative."
            );
          }
          return Math.sqrt(first);

        case "cbrt":
          return Math.cbrt(first);

        case "log":
          if (first <= 0) {
            throw new Error(
              "Logarithm input must be positive."
            );
          }
          return Math.log10(first);

        case "log2":
          if (first <= 0) {
            throw new Error(
              "Logarithm input must be positive."
            );
          }
          return Math.log2(first);

        case "floor":
          return Math.floor(first);

        case "ceil":
          return Math.ceil(first);

        case "fact":
          return factorial(first);

        case "pow":
          if (second === undefined) {
            throw new Error("pow requires two values.");
          }
          return Math.pow(first, second);

        case "intdiv":
          if (second === undefined || second === 0) {
            throw new Error(
              "intdiv requires two values and a non-zero divisor."
            );
          }
          return Math.trunc(first / second);
      }
    }

    throw new Error("Unexpected symbol.");
  }

  // FACTORIAL
  function postfix() {
    let value = primary();

    while (
      tokens[position] &&
      tokens[position].type === "!"
    ) {
      position++;
      value = factorial(value);
    }

    return value;
  }

  // EXPONENT
  function power() {
    const left = postfix();

    if (
      tokens[position] &&
      tokens[position].type === "^"
    ) {
      position++;
      return Math.pow(left, unary());
    }

    return left;
  }

  // POSITIVE AND NEGATIVE
  function unary() {
    if (
      tokens[position] &&
      tokens[position].type === "+"
    ) {
      position++;
      return unary();
    }

    if (
      tokens[position] &&
      tokens[position].type === "-"
    ) {
      position++;
      return -unary();
    }

    return power();
  }

  // MULTIPLICATION, DIVISION, MODULO
  function multiplyDivide() {
    let value = unary();

    while (
      tokens[position] &&
      ["*", "/", "%"].includes(tokens[position].type)
    ) {
      const operator = tokens[position++].type;
      const right = unary();

      if (
        (operator === "/" || operator === "%") &&
        right === 0
      ) {
        throw new Error("Cannot divide by zero.");
      }

      if (operator === "*") {
        value *= right;
      }

      if (operator === "/") {
        value /= right;
      }

      if (operator === "%") {
        value %= right;
      }
    }

    return value;
  }

  // ADDITION AND SUBTRACTION
  function addSub() {
    let value = multiplyDivide();

    while (
      tokens[position] &&
      ["+", "-"].includes(tokens[position].type)
    ) {
      const operator = tokens[position++].type;
      const right = multiplyDivide();

      value =
        operator === "+"
          ? value + right
          : value - right;
    }

    return value;
  }

  const answer = addSub();

  if (position !== tokens.length) {
    throw new Error(
      "Please check the expression syntax."
    );
  }

  if (!Number.isFinite(answer)) {
    throw new Error(
      "The result is outside the supported range."
    );
  }

  return answer;
}

// GET VARIABLE VALUES
function getVariables() {
  const values = {};

  ["A", "B", "C", "D"].forEach(letter => {
    const value = Number($("var" + letter).value);

    if (!Number.isFinite(value)) {
      throw new Error(
        "Enter a valid value for variable " + letter + "."
      );
    }

    values[letter] = value;
  });

  return values;
}

// FORMAT ANSWER
function formatAnswer(value) {
  if (Object.is(value, -0)) {
    value = 0;
  }

  return Number(value.toPrecision(12)).toString();
}

// CALCULATE
function calculate() {
  const formula = expressionInput.value.trim();

  try {
    const answer = evaluate(formula, getVariables());
    const formattedAnswer = formatAnswer(answer);

    $("formulaDisplay").textContent = formula || "0";
    $("answerDisplay").textContent = formattedAnswer;

    setStatus("Calculation successful.");

    calculationHistory.unshift({
      formula,
      answer: formattedAnswer
    });

    renderHistory();

  } catch (error) {
    setStatus(error.message, true);
  }
}

// CALCULATION HISTORY
function renderHistory() {
  const list = $("historyList");

  list.innerHTML = "";

  if (!calculationHistory.length) {
    list.innerHTML =
      '<p class="empty">Your calculations will appear here.</p>';

    return;
  }

  calculationHistory.slice(0, 12).forEach(item => {
    const button = document.createElement("button");

    button.className = "history-item";

    const formula = document.createElement("div");
    formula.className = "history-formula";
    formula.textContent = item.formula;

    const answer = document.createElement("div");
    answer.className = "history-answer";
    answer.textContent = "= " + item.answer;

    button.append(formula, answer);

    button.addEventListener("click", () => {
      expressionInput.value = item.formula;

      $("formulaDisplay").textContent = item.formula;
      $("answerDisplay").textContent = item.answer;

      setStatus("Loaded a previous calculation.");
    });

    list.appendChild(button);
  });
}

// INSERT BUTTONS
document.querySelectorAll("[data-insert]").forEach(button => {
  button.addEventListener("click", () => {
    insertAtCursor(button.dataset.insert);
  });
});

// ACTION BUTTONS
document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;

    if (action === "clear") {
      expressionInput.value = "";

      $("formulaDisplay").textContent = "0";
      $("answerDisplay").textContent = "0";

      setStatus("Cleared.");

      expressionInput.focus();

    } else if (action === "backspace") {
      const start =
        expressionInput.selectionStart ??
        expressionInput.value.length;

      const end =
        expressionInput.selectionEnd ??
        expressionInput.value.length;

      if (start !== end) {
        expressionInput.setRangeText(
          "",
          start,
          end,
          "end"
        );

      } else if (start > 0) {
        expressionInput.setRangeText(
          "",
          start - 1,
          start,
          "end"
        );
      }

      expressionInput.focus();

    } else {
      calculate();
    }
  });
});

// CALCULATE BUTTON
$("calculateBtn").addEventListener("click", calculate);

// ENTER KEY
expressionInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    calculate();
  }
});

// CLEAR HISTORY
$("clearHistory").addEventListener("click", () => {
  calculationHistory = [];
  renderHistory();
});

// MODE TABS
document.querySelectorAll(".mode-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".mode-tab").forEach(item => {
      item.classList.remove("active");
    });

    tab.classList.add("active");

    $("scientificPanel").classList.toggle(
      "visible",
      tab.dataset.mode === "scientific"
    );

    $("dsaPanel").classList.toggle(
      "visible",
      tab.dataset.mode === "dsa"
    );
  });
});
