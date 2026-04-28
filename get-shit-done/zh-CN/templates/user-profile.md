# 开发者画像

> 该画像基于会话分析生成，包含 Claude 与这位开发者协作时应遵循的行为指令。
> HIGH 置信度维度应直接执行。
> LOW 置信度维度应更谨慎处理，
> 例如使用保留表达（"Based on your profile, I'll try X -- let me know if that's off"）。

**Generated:** {{generated_at}}
**Source:** {{data_source}}
**Projects Analyzed:** {{projects_list}}
**Messages Analyzed:** {{message_count}}

---

## Quick Reference

{{summary_instructions}}

---

## Communication Style

**Rating:** {{communication_style.rating}} | **Confidence:** {{communication_style.confidence}}

**Directive:** {{communication_style.claude_instruction}}

{{communication_style.summary}}

**Evidence:**

{{communication_style.evidence}}

---

## Decision Speed

**Rating:** {{decision_speed.rating}} | **Confidence:** {{decision_speed.confidence}}

**Directive:** {{decision_speed.claude_instruction}}

{{decision_speed.summary}}

**Evidence:**

{{decision_speed.evidence}}

---

## Explanation Depth

**Rating:** {{explanation_depth.rating}} | **Confidence:** {{explanation_depth.confidence}}

**Directive:** {{explanation_depth.claude_instruction}}

{{explanation_depth.summary}}

**Evidence:**

{{explanation_depth.evidence}}

---

## Debugging Approach

**Rating:** {{debugging_approach.rating}} | **Confidence:** {{debugging_approach.confidence}}

**Directive:** {{debugging_approach.claude_instruction}}

{{debugging_approach.summary}}

**Evidence:**

{{debugging_approach.evidence}}

---

## UX Philosophy

**Rating:** {{ux_philosophy.rating}} | **Confidence:** {{ux_philosophy.confidence}}

**Directive:** {{ux_philosophy.claude_instruction}}

{{ux_philosophy.summary}}

**Evidence:**

{{ux_philosophy.evidence}}

---

## Vendor Philosophy

**Rating:** {{vendor_philosophy.rating}} | **Confidence:** {{vendor_philosophy.confidence}}

**Directive:** {{vendor_philosophy.claude_instruction}}

{{vendor_philosophy.summary}}

**Evidence:**

{{vendor_philosophy.evidence}}

---

## Frustration Triggers

**Rating:** {{frustration_triggers.rating}} | **Confidence:** {{frustration_triggers.confidence}}

**Directive:** {{frustration_triggers.claude_instruction}}

{{frustration_triggers.summary}}

**Evidence:**

{{frustration_triggers.evidence}}

---

## Learning Style

**Rating:** {{learning_style.rating}} | **Confidence:** {{learning_style.confidence}}

**Directive:** {{learning_style.claude_instruction}}

{{learning_style.summary}}

**Evidence:**

{{learning_style.evidence}}

---

## 画像元数据

| Field | Value |
|-------|-------|
| Profile Version | {{profile_version}} |
| Generated | {{generated_at}} |
| Source | {{data_source}} |
| Projects | {{projects_count}} |
| Messages | {{message_count}} |
| Dimensions Scored | {{dimensions_scored}}/8 |
| High Confidence | {{high_confidence_count}} |
| Medium Confidence | {{medium_confidence_count}} |
| Low Confidence | {{low_confidence_count}} |
| Sensitive Content Excluded | {{sensitive_excluded_summary}} |
