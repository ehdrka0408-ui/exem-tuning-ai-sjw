# 고객요청 SQL : 장애이력조회.sql
SQL_ID : 2xfj9z23nsq7w


# 바인드 변수
B1 = '20210101'
B2 = '20241121'

# 성능요약
튜닝 전 : 858K Block(4.38초)
튜닝 후 : 4944 Block(0.05초)

# 튜닝내역
[문제점]
1. 스칼라 서브쿼리인 구성항목명 컬럼에서 비효율 발생
2. 전체집합인 건수만큼 12번 ESO_CM 테이블 스캔 후  ESO_WF_CM테이블 필터 처리하며 662,000번 반복 스캔하여 비효율 발생


[해결책]
쿼리 수정
1. 구성항목명 컬럼의 스칼라서브쿼리를 인라인뷰로 변경하여 ESO_CM, ESO_WF_CM 테이블 HASH JOIN 유도



# 튜닝 전 (SQL 및 PLAN)
select icm_id -- 장애 ID
     , icm_id as key
     , icm_tas_id as tas_id -- 단계
     , get_tasname(icm_tas_id) as tas_name  -- 단계명
     , get_empdptname(icm_reg_emp_id) as empdpt_name   -- 요청부서
     , get_empname(icm_reg_emp_id) as emp_name   -- 요청자
     , get_codename(icm_work_area_cd) as work_area_name -- 장애구분
     , nvl(icm_req_title,'제목없음') as req_title -- 제목
     , icm_grade_cd AS grade_cd   --장애등급
     , get_codename(icm_grade_cd) AS grade_name --장애등급명
     , icm_med_cd as med_cd    -- 장애인지경로
     , get_codename(icm_med_cd) as med_name -- 장애인지경로명
     , decode(icm_wor_yn,'1','가동','미가동') as wor_yn --장애처리반가동여부
     , decode(icm_sol_cd,'ICMSOL09',get_empdptname(icm_prt_ass_emp_id),(SELECT DISTINCT get_empdptname(wff_emp_id) FROM eso_icm_wf WHERE wff_src_id = icm_id AND wff_tas_id = 'TICM12010' AND rownum =1)) AS ass_dpt_name -- 처리부서
     , decode(icm_sol_cd,'ICMSOL09',get_empname(icm_prt_ass_emp_id),(SELECT DISTINCT get_empname(wff_emp_id) FROM eso_icm_wf WHERE wff_src_id = icm_id AND wff_tas_id = 'TICM12010' AND rownum =1)) AS ass_emp_name    -- 처리자
     , fm_ldttm(icm_dcs_rec_dttm) as dec_rec_dttm -- 인지일시
     , icm_imp_cd AS imp_cd -- 영형도
     , get_codename(icm_imp_cd) AS imp_name   -- 영향도명
     , fm_ldttm(icm_actstart_dttm) as rec_dttm -- 장애발생일시
     , fm_ldttm(icm_actfinish_dttm) as actfinish_dttm -- 조치완료일시
     , decode(icm_rel_dttm,'','',icm_rel_dttm||' 분') as rel_dttm -- 총 장애시간
     , decode(icm_svc_stop_yn,'1','중단','무중단') as svc_stop_yn --서비스 중단 여부
     ,(select listagg(cm_name, ',') within group(order by cm_name)
       from eso_cm  where cm_id in (select wfc_cm_id from eso_wf_cm where wfc_src_id = icm_id)) as cm_name   -- 구성항목명
     , icm_cas_cd as cas_cd -- 장애원인
     , get_codename(icm_cas_cd) as cas_name -- 장애원인명
     , decode(icm_sol_yn,'1','완전해결','임시해결') as sol_yn --장애해결방법
     , icm_slo_cd as slo_cd -- 장애해결유형
     , get_codename(icm_slo_cd) as slo_name -- 장애해결유형명
     , decode(icm_act_mh,'','',icm_act_mh||' (M/H)') as act_mh -- 총 투입시간
from eso_icm icm
where icm_tas_id not in ('TAS03454',
                       'TICM21020',
                       'TICM21030',
                       'TICM22010',
                       'TICM23010',
                       'TICM24010',
                       'TICM25010',
                       'TICM25030') -- 임시저장, 장애전파(TICM2~)
 and  ICM_REQ_DTTM between  :B1  || '000000' and   :B2  || '235959'
order by icm_actstart_dttm desc,  icm_id desc


PLAN_TABLE_OUTPUT
Plan hash value: 3144043503

-----------------------------------------------------------------------------------------------------------------------------------------------
| Id  | Operation                             | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |  OMem |  1Mem |  O/1/M   |
-----------------------------------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                      |                  |      1 |        |     12 |00:00:04.38 |     858K|       |       |          |
|   1 |  SORT UNIQUE                          |                  |      2 |      1 |      1 |00:00:00.01 |      15 |  2048 |  2048 |     1/0/0|
|*  2 |   COUNT STOPKEY                       |                  |      2 |        |      1 |00:00:00.01 |      11 |       |       |          |
|   3 |    TABLE ACCESS BY INDEX ROWID BATCHED| ESO_ICM_WF       |      2 |      1 |      1 |00:00:00.01 |      11 |       |       |          |
|   4 |     BITMAP CONVERSION TO ROWIDS       |                  |      2 |        |      1 |00:00:00.01 |      10 |       |       |          |
|   5 |      BITMAP AND                       |                  |      2 |        |      1 |00:00:00.01 |      10 |       |       |          |
|   6 |       BITMAP CONVERSION FROM ROWIDS   |                  |      2 |        |      2 |00:00:00.01 |       4 |       |       |          |
|*  7 |        INDEX RANGE SCAN               | IX_ESO_ICM_WF_02 |      2 |      8 |     10 |00:00:00.01 |       4 |       |       |          |
|   8 |       BITMAP CONVERSION FROM ROWIDS   |                  |      2 |        |      2 |00:00:00.01 |       6 |       |       |          |
|*  9 |        INDEX RANGE SCAN               | IX_ESO_ICM_WF_01 |      2 |      8 |    612 |00:00:00.01 |       6 |       |       |          |
|  10 |  SORT UNIQUE                          |                  |      2 |      1 |      1 |00:00:00.01 |      13 |  2048 |  2048 |     1/0/0|
|* 11 |   COUNT STOPKEY                       |                  |      2 |        |      1 |00:00:00.01 |      11 |       |       |          |
|  12 |    TABLE ACCESS BY INDEX ROWID BATCHED| ESO_ICM_WF       |      2 |      1 |      1 |00:00:00.01 |      11 |       |       |          |
|  13 |     BITMAP CONVERSION TO ROWIDS       |                  |      2 |        |      1 |00:00:00.01 |      10 |       |       |          |
|  14 |      BITMAP AND                       |                  |      2 |        |      1 |00:00:00.01 |      10 |       |       |          |
|  15 |       BITMAP CONVERSION FROM ROWIDS   |                  |      2 |        |      2 |00:00:00.01 |       4 |       |       |          |
|* 16 |        INDEX RANGE SCAN               | IX_ESO_ICM_WF_02 |      2 |      8 |     10 |00:00:00.01 |       4 |       |       |          |
|  17 |       BITMAP CONVERSION FROM ROWIDS   |                  |      2 |        |      2 |00:00:00.01 |       6 |       |       |          |
|* 18 |        INDEX RANGE SCAN               | IX_ESO_ICM_WF_01 |      2 |      8 |    612 |00:00:00.01 |       6 |       |       |          |
|  19 |  SORT GROUP BY                        |                  |     12 |      1 |     12 |00:00:04.37 |     858K|  2048 |  2048 |     1/0/0|
|* 20 |   FILTER                              |                  |     12 |        |      1 |00:00:04.37 |     858K|       |       |          |
|  21 |    TABLE ACCESS FULL                  | ESO_CM           |     12 |  55185 |    662K|00:00:00.41 |   51456 |       |       |          |
|* 22 |    TABLE ACCESS BY INDEX ROWID BATCHED| ESO_WF_CM        |    662K|      1 |      1 |00:00:02.71 |     806K|       |       |          |
|* 23 |     INDEX RANGE SCAN                  | ESO_WF_CM_01     |    662K|      4 |  74986 |00:00:01.83 |     747K|       |       |          |
|  24 |  SORT ORDER BY                        |                  |      1 |     11 |     12 |00:00:04.38 |     858K|  9216 |  9216 |     1/0/0|
|* 25 |   TABLE ACCESS FULL                   | ESO_ICM          |      1 |     11 |     12 |00:00:00.01 |     127 |       |       |          |
-----------------------------------------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - filter(ROWNUM=1)
   7 - access("WFF_SRC_ID"=:B1)
   9 - access("WFF_TAS_ID"='TICM12010')
  11 - filter(ROWNUM=1)
  16 - access("WFF_SRC_ID"=:B1)
  18 - access("WFF_TAS_ID"='TICM12010')
  20 - filter( IS NOT NULL)
  22 - filter("WFC_SRC_ID"=:B1)
  23 - access("WFC_CM_ID"=:B1)
  25 - filter(("ICM_TAS_ID"<>'TICM25010' AND "ICM_TAS_ID"<>'TAS03454' AND "ICM_TAS_ID"<>'TICM21020' AND "ICM_TAS_ID"<>'TICM21030' AND
              "ICM_TAS_ID"<>'TICM22010' AND "ICM_TAS_ID"<>'TICM23010' AND "ICM_TAS_ID"<>'TICM24010' AND "ICM_TAS_ID"<>'TICM25030' AND
              "ICM_REQ_DTTM"<='20241121235959' AND "ICM_REQ_DTTM">='20210101000000'))


# 튜닝 후 (SQL 및 PLAN)
select icm_id -- 장애 ID
     , icm_id as key
     , icm_tas_id as tas_id -- 단계
     , get_tasname(icm_tas_id) as tas_name  -- 단계명
     , get_empdptname(icm_reg_emp_id) as empdpt_name   -- 요청부서
     , get_empname(icm_reg_emp_id) as emp_name   -- 요청자
     , get_codename(icm_work_area_cd) as work_area_name -- 장애구분
     , nvl(icm_req_title,'제목없음') as req_title -- 제목
     , icm_grade_cd AS grade_cd   --장애등급
     , get_codename(icm_grade_cd) AS grade_name --장애등급명
     , icm_med_cd as med_cd    -- 장애인지경로
     , get_codename(icm_med_cd) as med_name -- 장애인지경로명
     , decode(icm_wor_yn,'1','가동','미가동') as wor_yn --장애처리반가동여부
     , decode(icm_sol_cd,'ICMSOL09',get_empdptname(icm_prt_ass_emp_id),(SELECT DISTINCT get_empdptname(wff_emp_id) FROM eso_icm_wf WHERE wff_src_id = icm_id AND wff_tas_id = 'TICM12010' AND rownum =1)) AS ass_dpt_name -- 처리부서
     , decode(icm_sol_cd,'ICMSOL09',get_empname(icm_prt_ass_emp_id),(SELECT DISTINCT get_empname(wff_emp_id) FROM eso_icm_wf WHERE wff_src_id = icm_id AND wff_tas_id = 'TICM12010' AND rownum =1)) AS ass_emp_name    -- 처리자
     , fm_ldttm(icm_dcs_rec_dttm) as dec_rec_dttm -- 인지일시
     , icm_imp_cd AS imp_cd -- 영형도
     , get_codename(icm_imp_cd) AS imp_name   -- 영향도명
     , fm_ldttm(icm_actstart_dttm) as rec_dttm -- 장애발생일시
     , fm_ldttm(icm_actfinish_dttm) as actfinish_dttm -- 조치완료일시
     , decode(icm_rel_dttm,'','',icm_rel_dttm||' 분') as rel_dttm -- 총 장애시간
     , decode(icm_svc_stop_yn,'1','중단','무중단') as svc_stop_yn --서비스 중단 여부
     --,(select listagg(cm_name, ',') within group(order by cm_name)
     --  from eso_cm  where cm_id in (select wfc_cm_id from eso_wf_cm where wfc_src_id = icm_id)) as cm_name   -- 구성항목명
     , cm_name --인라인뷰 구성항목명
     , icm_cas_cd as cas_cd -- 장애원인
     , get_codename(icm_cas_cd) as cas_name -- 장애원인명
     , decode(icm_sol_yn,'1','완전해결','임시해결') as sol_yn --장애해결방법
     , icm_slo_cd as slo_cd -- 장애해결유형
     , get_codename(icm_slo_cd) as slo_name -- 장애해결유형명
     , decode(icm_act_mh,'','',icm_act_mh||' (M/H)') as act_mh -- 총 투입시간
from eso_icm icm
     , (
         select
                listagg(cm_name, ',') within group(order by cm_name) as cm_name, ewc.wfc_src_id
         from eso_cm ec, (select wfc_cm_id, wfc_src_id
                         from eso_wf_cm
                         where 1=1
                         group by wfc_src_id, wfc_cm_id) ewc
         where ec.cm_id = ewc.wfc_cm_id
         group by wfc_src_id
         ) v
where icm_tas_id not in ('TAS03454',
                       'TICM21020',
                       'TICM21030',
                       'TICM22010',
                       'TICM23010',
                       'TICM24010',
                       'TICM25010',
                       'TICM25030') -- 임시저장, 장애전파(TICM2~)
 and  ICM_REQ_DTTM between  :B1  || '000000' and   :B2  || '235959'
 and  v.wfc_src_id (+) = icm.icm_id  --join key
order by icm_actstart_dttm desc, icm_id desc



PLAN_TABLE_OUTPUT
Plan hash value: 1977669637

-----------------------------------------------------------------------------------------------------------------------------------------------
| Id  | Operation                             | Name             | Starts | E-Rows | A-Rows |   A-Time   | Buffers |  OMem |  1Mem |  O/1/M   |
-----------------------------------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                      |                  |      1 |        |     12 |00:00:00.05 |    4944 |       |       |          |
|   1 |  SORT UNIQUE                          |                  |      2 |      1 |      1 |00:00:00.01 |      15 |  2048 |  2048 |     1/0/0|
|*  2 |   COUNT STOPKEY                       |                  |      2 |        |      1 |00:00:00.01 |      11 |       |       |          |
|   3 |    TABLE ACCESS BY INDEX ROWID BATCHED| ESO_ICM_WF       |      2 |      1 |      1 |00:00:00.01 |      11 |       |       |          |
|   4 |     BITMAP CONVERSION TO ROWIDS       |                  |      2 |        |      1 |00:00:00.01 |      10 |       |       |          |
|   5 |      BITMAP AND                       |                  |      2 |        |      1 |00:00:00.01 |      10 |       |       |          |
|   6 |       BITMAP CONVERSION FROM ROWIDS   |                  |      2 |        |      2 |00:00:00.01 |       4 |       |       |          |
|*  7 |        INDEX RANGE SCAN               | IX_ESO_ICM_WF_02 |      2 |      8 |     10 |00:00:00.01 |       4 |       |       |          |
|   8 |       BITMAP CONVERSION FROM ROWIDS   |                  |      2 |        |      2 |00:00:00.01 |       6 |       |       |          |
|*  9 |        INDEX RANGE SCAN               | IX_ESO_ICM_WF_01 |      2 |      8 |    612 |00:00:00.01 |       6 |       |       |          |
|  10 |  SORT UNIQUE                          |                  |      2 |      1 |      1 |00:00:00.01 |      13 |  2048 |  2048 |     1/0/0|
|* 11 |   COUNT STOPKEY                       |                  |      2 |        |      1 |00:00:00.01 |      11 |       |       |          |
|  12 |    TABLE ACCESS BY INDEX ROWID BATCHED| ESO_ICM_WF       |      2 |      1 |      1 |00:00:00.01 |      11 |       |       |          |
|  13 |     BITMAP CONVERSION TO ROWIDS       |                  |      2 |        |      1 |00:00:00.01 |      10 |       |       |          |
|  14 |      BITMAP AND                       |                  |      2 |        |      1 |00:00:00.01 |      10 |       |       |          |
|  15 |       BITMAP CONVERSION FROM ROWIDS   |                  |      2 |        |      2 |00:00:00.01 |       4 |       |       |          |
|* 16 |        INDEX RANGE SCAN               | IX_ESO_ICM_WF_02 |      2 |      8 |     10 |00:00:00.01 |       4 |       |       |          |
|  17 |       BITMAP CONVERSION FROM ROWIDS   |                  |      2 |        |      2 |00:00:00.01 |       6 |       |       |          |
|* 18 |        INDEX RANGE SCAN               | IX_ESO_ICM_WF_01 |      2 |      8 |    612 |00:00:00.01 |       6 |       |       |          |
|  19 |  SORT ORDER BY                        |                  |      1 |      1 |     12 |00:00:00.05 |    4944 |  9216 |  9216 |     1/0/0|
|* 20 |   FILTER                              |                  |      1 |        |     12 |00:00:00.04 |    4542 |       |       |          |
|* 21 |    HASH JOIN OUTER                    |                  |      1 |      1 |     12 |00:00:00.04 |    4542 |   762K|   762K|     1/0/0|
|  22 |     JOIN FILTER CREATE                | :BF0000          |      1 |      1 |     12 |00:00:00.01 |     127 |       |       |          |
|* 23 |      TABLE ACCESS FULL                | ESO_ICM          |      1 |      1 |     12 |00:00:00.01 |     127 |       |       |          |
|  24 |     VIEW                              |                  |      1 |   2717 |      2 |00:00:00.04 |    4415 |       |       |          |
|  25 |      SORT GROUP BY                    |                  |      1 |   2717 |      2 |00:00:00.04 |    4415 |  2048 |  2048 |     1/0/0|
|  26 |       VIEW                            | VM_NWVW_1        |      1 |   7330 |      2 |00:00:00.04 |    4415 |       |       |          |
|  27 |        HASH GROUP BY                  |                  |      1 |   7330 |      2 |00:00:00.04 |    4415 |  1681K|  1223K|     1/0/0|
|  28 |         JOIN FILTER USE               | :BF0000          |      1 |   7330 |      3 |00:00:00.04 |    4415 |       |       |          |
|* 29 |          HASH JOIN                    |                  |      1 |   7330 |   6250 |00:00:00.04 |    4415 |  1601K|  1601K|     1/0/0|
|  30 |           TABLE ACCESS FULL           | ESO_WF_CM        |      1 |   8167 |   8748 |00:00:00.01 |     126 |       |       |          |
|  31 |           TABLE ACCESS FULL           | ESO_CM           |      1 |  55185 |  55214 |00:00:00.03 |    4288 |       |       |          |
-----------------------------------------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - filter(ROWNUM=1)
   7 - access("WFF_SRC_ID"=:B1)
   9 - access("WFF_TAS_ID"='TICM12010')
  11 - filter(ROWNUM=1)
  16 - access("WFF_SRC_ID"=:B1)
  18 - access("WFF_TAS_ID"='TICM12010')
  20 - filter(:B2||'235959'>=:B1||'000000')
  21 - access("V"."WFC_SRC_ID"="ICM"."ICM_ID")
  23 - filter(("ICM_TAS_ID"<>'TICM25010' AND "ICM_REQ_DTTM">=:B1||'000000' AND "ICM_REQ_DTTM"<=:B2||'235959' AND
              "ICM_TAS_ID"<>'TAS03454' AND "ICM_TAS_ID"<>'TICM21020' AND "ICM_TAS_ID"<>'TICM21030' AND "ICM_TAS_ID"<>'TICM22010' AND
              "ICM_TAS_ID"<>'TICM23010' AND "ICM_TAS_ID"<>'TICM24010' AND "ICM_TAS_ID"<>'TICM25030'))
  29 - access("EC"."CM_ID"="WFC_CM_ID")
