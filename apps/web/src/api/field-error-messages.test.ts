import { describe, expect, it } from "vitest";
import {
  getCategoryFormFieldErrorMessage,
  getCustomerFormFieldErrorMessage,
  getProductFormFieldErrorMessage,
  getTagFormFieldErrorMessage,
  getTaskFieldErrorMessage
} from "./field-error-messages";

describe("field error messages", () => {
  it("returns the customer form field messages", () => {
    expect(getCustomerFormFieldErrorMessage("name", "100文字")).toBe(
      "顧客名は100文字以内で入力してください。"
    );
    expect(getCustomerFormFieldErrorMessage("name", "別のエラー")).toBe(
      "顧客名を入力してください。"
    );
    expect(getCustomerFormFieldErrorMessage("customerStyle")).toBe(
      "系統メモは100文字以内で入力してください。"
    );
    expect(getCustomerFormFieldErrorMessage("memo")).toBe(
      "顧客メモは1000文字以内で入力してください。"
    );
    expect(getCustomerFormFieldErrorMessage("snsAccounts")).toBe(
      "SNSアカウントの入力内容を確認してください。"
    );
  });

  it("returns the category form field messages", () => {
    expect(getCategoryFormFieldErrorMessage("name", "50文字")).toBe(
      "カテゴリ名は50文字以内で入力してください。"
    );
    expect(getCategoryFormFieldErrorMessage("name", "別のエラー")).toBe(
      "カテゴリ名を入力してください。"
    );
    expect(getCategoryFormFieldErrorMessage("sortOrder")).toBe(
      "表示順を入力してください。"
    );
  });

  it("returns the tag form field messages", () => {
    expect(getTagFormFieldErrorMessage("name", "50文字")).toBe(
      "タグ名は50文字以内で入力してください。"
    );
    expect(getTagFormFieldErrorMessage("name", "別のエラー")).toBe(
      "タグ名を入力してください。"
    );
  });

  it("returns the product form field messages", () => {
    expect(getProductFormFieldErrorMessage("name", "100文字")).toBe(
      "商品名は100文字以内で入力してください。"
    );
    expect(getProductFormFieldErrorMessage("name", "別のエラー")).toBe(
      "商品名を入力してください。"
    );
    expect(getProductFormFieldErrorMessage("description")).toBe(
      "商品説明は2000文字以内で入力してください。"
    );
    expect(getProductFormFieldErrorMessage("price")).toBe(
      "価格は0以上の整数で入力してください。"
    );
    expect(getProductFormFieldErrorMessage("categoryId")).toBe(
      "カテゴリを選択してください。"
    );
    expect(getProductFormFieldErrorMessage("tagIds")).toBe(
      "タグを選択してください。"
    );
    expect(getProductFormFieldErrorMessage("status")).toBe(
      "ステータスを選択してください。"
    );
    expect(getProductFormFieldErrorMessage("primaryImageId")).toBe(
      "代表画像の指定を確認してください。"
    );
    expect(getProductFormFieldErrorMessage("soldCustomerId")).toBe(
      "選択した顧客を確認してください。"
    );
  });

  it("returns the task field messages", () => {
    expect(getTaskFieldErrorMessage("name", "100文字")).toBe(
      "タスク名は100文字以内で入力してください。"
    );
    expect(getTaskFieldErrorMessage("name", "別のエラー")).toBe(
      "タスク名を入力してください。"
    );
    expect(getTaskFieldErrorMessage("content")).toBe(
      "タスク内容は2000文字以内で入力してください。"
    );
    expect(getTaskFieldErrorMessage("dueDate")).toBe(
      "納期は YYYY-MM-DD 形式で入力してください。"
    );
    expect(getTaskFieldErrorMessage("memo")).toBe(
      "メモは1000文字以内で入力してください。"
    );
  });
});
