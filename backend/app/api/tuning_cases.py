from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select

from app.db.session import get_db
from app.models.tuning_case import TuningCase
from app.models.plan import Plan, BindVariable
from app.schemas.tuning_case import (
    TuningCaseSummary, TuningCaseDetail, PlanRead, BindVariableRead, AliasUpdate,
)

router = APIRouter(prefix="/api/cases", tags=["tuning_cases"])


@router.get("", response_model=list[TuningCaseSummary])
def list_cases(db: Session = Depends(get_db)):
    return db.execute(select(TuningCase).order_by(TuningCase.id.asc())).scalars().all()


@router.get("/{case_id}", response_model=TuningCaseDetail)
def get_case(case_id: int, db: Session = Depends(get_db)):
    obj = db.get(TuningCase, case_id)
    if not obj:
        raise HTTPException(404, "not found")
    plans = db.execute(
        select(Plan).where(Plan.case_id == case_id).order_by(Plan.phase.desc())
    ).scalars().all()
    binds = db.execute(
        select(BindVariable).where(BindVariable.case_id == case_id).order_by(BindVariable.position)
    ).scalars().all()
    detail = TuningCaseDetail.model_validate(obj)
    detail.plans = [PlanRead.model_validate(p) for p in plans]
    detail.bind_variables = [BindVariableRead.model_validate(b) for b in binds]
    return detail


@router.patch("/{case_id}/alias", response_model=TuningCaseSummary)
def update_alias(case_id: int, body: AliasUpdate, db: Session = Depends(get_db)):
    obj = db.get(TuningCase, case_id)
    if not obj:
        raise HTTPException(404, "not found")
    obj.alias = (body.alias or None)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/by-sql-id/{sql_id}/alias", response_model=TuningCaseSummary)
def update_alias_by_sql_id(sql_id: str, body: AliasUpdate, db: Session = Depends(get_db)):
    obj = db.execute(select(TuningCase).where(TuningCase.sql_id == sql_id)).scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "tuning_case with sql_id not found")
    obj.alias = (body.alias or None)
    db.commit()
    db.refresh(obj)
    return obj
