/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {AST, AstVisitor, ASTWithSource, Binary, BindingPipe, Call, Chain, Conditional, ImplicitReceiver, Interpolation, KeyedRead, KeyedWrite, LiteralArray, LiteralMap, LiteralPrimitive, NonNullAssert, PrefixNot, PropertyRead, PropertyWrite, Quote, RecursiveAstVisitor, SafeCall, SafeKeyedRead, SafePropertyRead, ThisReceiver, Unary} from '../../../src/expression_parser/ast';
import {DEFAULT_INTERPOLATION_CONFIG, InterpolationConfig} from '../../../src/ml_parser/interpolation_config';

class Unparser implements AstVisitor {
  private static _quoteRegExp = /"/g;
  // TODO(issue/24571): remove '!'.
  private _expression!: string;
  // TODO(issue/24571): remove '!'.
  private _interpolationConfig!: InterpolationConfig;

  unparse(ast: AST, interpolationConfig: InterpolationConfig) {
    this._expression = '';
    this._interpolationConfig = interpolationConfig;
    this._visit(ast);
    return this._expression;
  }

  visitPropertyRead(ast: PropertyRead, context: any) {
    this._visit(ast.receiver);
    this._expression += ast.receiver instanceof ImplicitReceiver ? `${ast.name}` : `.${ast.name}`;
  }

  visitPropertyWrite(ast: PropertyWrite, context: any) {
    this._visit(ast.receiver);
    this._expression +=
        ast.receiver instanceof ImplicitReceiver ? `${ast.name} = ` : `.${ast.name} = `;
    this._visit(ast.value);
  }

  visitUnary(ast: Unary, context: any) {
    this._expression += ast.operator;
    this._visit(ast.expr);
  }

  visitBinary(ast: Binary, context: any) {
    this._visit(ast.left);
    this._expression += ` ${ast.operation} `;
    this._visit(ast.right);
  }

  visitChain(ast: Chain, context: any) {
    const len = ast.expressions.length;
    for (let i = 0; i < len; i++) {
      this._visit(ast.expressions[i]);
      this._expression += i == len - 1 ? ';' : '; ';
    }
  }

  visitConditional(ast: Conditional, context: any) {
    this._visit(ast.condition);
    this._expression += ' ? ';
    this._visit(ast.trueExp);
    this._expression += ' : ';
    this._visit(ast.falseExp);
  }

  visitPipe(ast: BindingPipe, context: any) {
    this._expression += '(';
    this._visit(ast.exp);
    this._expression += ` | ${ast.name}`;
    ast.args.forEach(arg => {
      this._expression += ':';
      this._visit(arg);
    });
    this._expression += ')';
  }

  visitCall(ast: Call, context: any) {
    this._visit(ast.receiver);
    this._expression += '(';
    let isFirst = true;
    ast.args.forEach(arg => {
      if (!isFirst) this._expression += ', ';
      isFirst = false;
      this._visit(arg);
    });
    this._expression += ')';
  }

  visitSafeCall(ast: SafeCall, context: any) {
    this._visit(ast.receiver);
    this._expression += '?.(';
    let isFirst = true;
    ast.args.forEach(arg => {
      if (!isFirst) this._expression += ', ';
      isFirst = false;
      this._visit(arg);
    });
    this._expression += ')';
  }

  visitImplicitReceiver(ast: ImplicitReceiver, context: any) {}

  visitThisReceiver(ast: ThisReceiver, context: any) {}

  visitInterpolation(ast: Interpolation, context: any) {
    for (let i = 0; i < ast.strings.length; i++) {
      this._expression += ast.strings[i];
      if (i < ast.expressions.length) {
        this._expression += `${this._interpolationConfig.start} `;
        this._visit(ast.expressions[i]);
        this._expression += ` ${this._interpolationConfig.end}`;
      }
    }
  }

  visitKeyedRead(ast: KeyedRead, context: any) {
    this._visit(ast.receiver);
    this._expression += '[';
    this._visit(ast.key);
    this._expression += ']';
  }

  visitKeyedWrite(ast: KeyedWrite, context: any) {
    this._visit(ast.receiver);
    this._expression += '[';
    this._visit(ast.key);
    this._expression += '] = ';
    this._visit(ast.value);
  }

  visitLiteralArray(ast: LiteralArray, context: any) {
    this._expression += '[';
    let isFirst = true;
    ast.expressions.forEach(expression => {
      if (!isFirst) this._expression += ', ';
      isFirst = false;
      this._visit(expression);
    });

    this._expression += ']';
  }

  visitLiteralMap(ast: LiteralMap, context: any) {
    this._expression += '{';
    let isFirst = true;
    for (let i = 0; i < ast.keys.length; i++) {
      if (!isFirst) this._expression += ', ';
      isFirst = false;
      const key = ast.keys[i];
      this._expression += key.quoted ? JSON.stringify(key.key) : key.key;
      this._expression += ': ';
      this._visit(ast.values[i]);
    }

    this._expression += '}';
  }

  visitLiteralPrimitive(ast: LiteralPrimitive, context: any) {
    if (typeof ast.value === 'string') {
      this._expression += `"${ast.value.replace(Unparser._quoteRegExp, '\"')}"`;
    } else {
      this._expression += `${ast.value}`;
    }
  }

  visitPrefixNot(ast: PrefixNot, context: any) {
    this._expression += '!';
    this._visit(ast.expression);
  }

  visitNonNullAssert(ast: NonNullAssert, context: any) {
    this._visit(ast.expression);
    this._expression += '!';
  }

  visitSafePropertyRead(ast: SafePropertyRead, context: any) {
    this._visit(ast.receiver);
    this._expression += `?.${ast.name}`;
  }

  visitQuote(ast: Quote, context: any) {
    this._expression += `${ast.prefix}:${ast.uninterpretedExpression}`;
  }

  visitSafeKeyedRead(ast: SafeKeyedRead, context: any) {
    this._visit(ast.receiver);
    this._expression += '?.[';
    this._visit(ast.key);
    this._expression += ']';
  }

  private _visit(ast: AST) {
    ast.visit(this);
  }
}

const sharedUnparser = new Unparser();

export function unparse(
    ast: AST, interpolationConfig: InterpolationConfig = DEFAULT_INTERPOLATION_CONFIG): string {
  return sharedUnparser.unparse(ast, interpolationConfig);
}

// [unparsed AST, original source code of AST]
type UnparsedWithSpan = [string, string];

export function unparseWithSpan(
    ast: ASTWithSource,
    interpolationConfig: InterpolationConfig = DEFAULT_INTERPOLATION_CONFIG): UnparsedWithSpan[] {
  const unparsed: UnparsedWithSpan[] = [];
  const source = ast.source!;
  const recursiveSpanUnparser = new class extends RecursiveAstVisitor {
    private recordUnparsed(ast: any, spanKey: string, unparsedList: UnparsedWithSpan[]) {
      const span = ast[spanKey];
      const prefix = spanKey === 'span' ? '' : `[${spanKey}] `;
      const src = source.substring(span.start, span.end);
      unparsedList.push([
        unparse(ast, interpolationConfig),
        prefix + src,
      ]);
    }

    override visit(ast: AST, unparsedList: UnparsedWithSpan[]) {
      this.recordUnparsed(ast, 'span', unparsedList);
      if (ast.hasOwnProperty('nameSpan')) {
        this.recordUnparsed(ast, 'nameSpan', unparsedList);
      }
      if (ast.hasOwnProperty('argumentSpan')) {
        this.recordUnparsed(ast, 'argumentSpan', unparsedList);
      }
      ast.visit(this, unparsedList);
    }
  };
  recursiveSpanUnparser.visitAll([ast.ast], unparsed);
  return unparsed;
}
