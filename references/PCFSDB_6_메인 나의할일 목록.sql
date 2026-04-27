# 고객요청 SQL : PCFSDB_6_메인_나의할일 목록

# 성능요약
튜닝 전 :  62350 Block(1.86초)
튜닝 후 :  61658 Block(0.79초)

# 일별이력
Date_____	sql_id_______	SCHEMA_NAME	MODULE____________________	EXECUTIONS___	ag_ROWS_PROCESSED_DELTA	avg_Physical_reads	avg_Logical_reads	avg_cpu_time	avg_elapsed_time	PHYSICALREADS_PCT	LOGICALREADS_PCT	CPUTIME_PCT	ELAPSEDTIME_PCT	program______________________
24/12/10	21hx22rb21ftr	     ITS_DB	          JDBC Thin Client	         1123	                      5	                 0	           356021	     3243553	         3253400	                0	            16.3	       13.2	           11.2	JDBC Thin Client
24/12/11	21hx22rb21ftr	     ITS_DB	          JDBC Thin Client	         2726	                      6	                 0	           290374	     2871167	         2882733	                0	             7.7	        7.7	            5.5	JDBC Thin Client
24/12/12	21hx22rb21ftr	     ITS_DB	          JDBC Thin Client	         3075	                      7	                 0	            64927	     1431148	         1436946	                0	             2.6	        5.2	            3.5	JDBC Thin Client
24/12/13	21hx22rb21ftr	     ITS_DB	          JDBC Thin Client	         2651	                      5	                 0	            63220	     1346405	         1352452	                0	               2	        4.2	            2.9	JDBC Thin Client
24/12/14	21hx22rb21ftr	     ITS_DB	          JDBC Thin Client	           13	                      3	                 0	            61595	     1281538	         1288569	                0	               0	          0	              0	JDBC Thin Client
24/12/15	21hx22rb21ftr	     ITS_DB	          JDBC Thin Client	           12	                      1	                 0	            61691	     1264167	         1265330	                0	               0	          0	              0	JDBC Thin Client
24/12/16	21hx22rb21ftr	     ITS_DB	          JDBC Thin Client	         2882	                      6	                 0	            61819	     1286194	         1291098	                0	             2.2	        4.4	            3.1	JDBC Thin Client
24/12/17	21hx22rb21ftr	     ITS_DB	          JDBC Thin Client	         1497	                      5	                 0	            62074	     1295170	         1301248	                0	             1.4	          3	            1.8	JDBC Thin Client

# 바인드 변수
1  = '2021014'
2  = '2021014'
3  = '2021014'
4  = '2021014'
5  = '2021014'
6  = '2021014'
7  = '2021014'
8  = '2021014'
9  = '2021014'
10 = '2021014'
11 = '2021014'
12 = '2021014'
13 = '2021014'
14 = '2021014'
15 = '2021014'
16 = '2021014'
17 = '2021014'
18 = '2021014'
19 = '2021014'
20 = '2021014'
21 = '2021014'
22 = '2021014'
23 = '2021014'

# 튜닝내역
[문제점]
    서브쿼리 filter 시 function call 부하
	메인집합 건수가 많을 수록 부하가 심함.
	
[가이드]
	1) get_sysdate -> TO_CHAR(SYSDATE,'yyyymmddhh24miss')
	2) fm_ldttm ->  case 문으로 변환		
	2) get_dptname -> 스칼라 서브쿼리로 변환
	3) get_empname -> 스칼라 서브쿼리로 변환

# 튜닝 전 (SQL 및 PLAN)
SELECT /* 메인 : 나의 할일 리스트 */
      T.ISS_SR_ID AS APR_ID -- ID
    , T.ISS_SR_ID AS ID -- ID
    , E.TAS_ENT_ID AS ENT_ID -- 엔티티 ID
    , case when iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
    else (SELECT NVL(ENT_LABEL, ENT_NAME)
        FROM EFC_ENTITY A
        WHERE A.ENT_ID = E.TAS_ENT_ID) end LOCALE_ENT_NM -- 엔티티명
    , E.TAS_ID -- 단계 ID
    , E.TAS_NAME
    , nvl((SELECT MAX(COD_NAME)
        FROM ECF_CODE A
        WHERE A.COD_USED=1
          AND A.COD_ID=T.ISS_CAT_CD),'-') AS CAT_NAME
    , (SELECT FM_LDTTM(T.ISS_REQ_DTTM) FROM DUAL) REQ_DTTM -- 요청일
    , (SELECT GET_EMPDPTNAME(T.ISS_REQ_EMP_ID) FROM DUAL) AS REQ_DPT_NAME
    , (SELECT GET_EMPNAME(T.ISS_REQ_EMP_ID) FROM DUAL) AS REQ_EMP_NAME
    --, SUBSTR(iss_src_id,1,3) as src_id -- 운영동기화
    --,CASE T.ISS_REQ_TITLE WHEN '' THEN '제목없음' ELSE T.ISS_REQ_TITLE END AS REQ_TITLE -- 제목
    , CASE
        WHEN T.ISS_REQ_TITLE = '' THEN '제목없음'
        WHEN T.ISS_CAT_CD ='WORCAT03' AND ISS_TAS_ID IN ('TAS03292','TAS03203')
        THEN (SELECT WOR_FORCE_NUM
                FROM ESO_WORKORDER A
                WHERE A.WOR_ID = T.ISS_SR_ID )
        ELSE T.ISS_REQ_TITLE
        END AS REQ_TITLE -- 제목
    , (SELECT GET_EMPNAME(ISS_ASS_EMP_ID) FROM DUAL) AS ASS_NAME
    , 'FORM' AS T_TYPE
    , '' AS API_ID
    , CASE
        WHEN TO_DATE(SUBSTR(T.ISS_DEAD_DTTM, 1, 8), 'YYYYMMDD') - TO_DATE(TO_CHAR(SYSDATE, 'YYYYMMDD'), 'YYYYMMDD') BETWEEN 0 AND 2 THEN 'G'
        WHEN TO_DATE(SUBSTR(T.ISS_DEAD_DTTM, 1, 8), 'YYYYMMDD') < TO_DATE(TO_CHAR(SYSDATE, 'YYYYMMDD'), 'YYYYMMDD') THEN 'R'
        ELSE ''
        END AS TEXT_COLOR
FROM ESO_ISSUE T
   , EWF_TASK E
   , EWF_ACTIVITY A
   , EWF_WORKFLOW W
WHERE T.ISS_TAS_ID = E.TAS_ID
  AND TAS_ENT_ID NOT IN ('UX120')
  AND E.TAS_TYPE IN ('1','2','4') -- 타스크 유형(접수,처리)
  AND E.TAS_ACT_ID = A.ACT_ID
  AND A.ACT_WOF_ID = W.WOF_ID
  --AND T.ISS_REG_DTTM >= TO_CHAR(SYSDATE - 31, 'YYYYMMDDHH24MISS') -- 최근 한달간
  AND (T.ISS_APP_ID <> 'pms' OR T.ISS_APP_ID IS NULL)
  AND T.ISS_ENT_ID NOT IN ('PMS', 'PTC', 'PRSK', 'PREQ', 'PFAM', 'PAI')
  and  ((ISS_ASS_EMP_ID =  :1  AND ISS_TAS_ID NOT IN ('TAS03165','TCSR12010','TCSR13010','TCHA13010','TCHA14030','TAS03180','TAS03197','TAS03192','TAS03223','TAS03430','TAS03443','TAS03340','TAS03336','TAS03337','TAS03449','TAS03352')) OR (ISS_ASS_WOG_ID IN ( SELECT MEM_WOG_ID FROM ECF_MEMBER WHERE MEM_EMP_ID =   :2    ) AND ISS_TAS_ID NOT IN ('TSRM14010')) OR (ISS_SR_ID IN (SELECT CHA_CSR_ID FROM ESO_CHA WHERE CHA_PL_EMP_ID =  :3  ) AND ISS_TAS_ID IN ('TAS03165','TCSR12010')) OR (ISS_SR_ID IN (SELECT CHA_CSR_ID FROM ESO_CHA WHERE CHA_PL_EMP_ID IN (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE GET_SYSDATE() BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM AND EMP_AGC_EMP_ID = :4 )) AND ISS_TAS_ID IN ('TAS03165', 'TCSR12010')) or (ISS_SR_ID IN (SELECT WOR_SRC_ID FROM ESO_WORKORDER WHERE WOR_CLA_CD IN ('CHIWORMH') AND WOR_ASS_EMP_ID = :5 ) AND ISS_TAS_ID IN ('TCHA13010')) OR (ISS_SR_ID IN (SELECT WOR_SRC_ID FROM ESO_WORKORDER WHERE WOR_CLA_CD = CASE WHEN (SELECT CHA_CAT_CD FROM ESO_CHA WHERE CHA_ID = ISS_SR_ID) IN ('CHMCAT01','CHMCAT03','CHMCAT05','CHMCAT07') THEN 'CHIWORMHREAL' ELSE 'CHIWORMH' END AND WOR_ASS_EMP_ID = :6 ) AND ISS_TAS_ID IN ('TCHA14030'))OR (ISS_ASS_EMP_ID IN (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE EMP_AGC_EMP_ID = :7  AND GET_SYSDATE()  BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM AND 3 != (SELECT TAS_TYPE FROM EWF_TASK WHERE TAS_ID = ISS_TAS_ID))) OR (ISS_ASS_WOG_ID IN (SELECT MEM_WOG_ID FROM ECF_MEMBER WHERE MEM_EMP_ID in (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE GET_SYSDATE() BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM AND EMP_AGC_EMP_ID = :8 ))) OR (ISS_TAS_ID IN ('TCHA13010', 'TCHA14030') AND ISS_SR_ID IN (SELECT WOR_SRC_ID FROM ESO_WORKORDER WHERE WOR_ASS_EMP_ID in (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE GET_SYSDATE() BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM AND EMP_AGC_EMP_ID = :9 )AND WOR_CLA_CD NOT IN ('CHIWORHD','CHIWORPEER','CHIWORSRC','CHIWORFORCE'))) OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TAS03415' AND ISS_SR_ID IN (SELECT ICM_ID FROM ESO_ICM WHERE ICM_TAS_ID ='TAS03415' AND ICM_EIM_ID IS NOT NULL  AND 'ITSV2202-04110' = (SELECT WFC_COD_ID FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-04110' AND WFC_SRC_ID =  :10  ))) OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TPBM11020' AND ISS_SR_ID IN (SELECT PBM_ID FROM ESO_PBM WHERE PBM_TAS_ID ='TPBM11020' AND PBM_WOG_TF = (SELECT WFC_COD_ID FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-04110' AND WFC_SRC_ID =  :11  )) OR (T.ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TPBM12010' AND  ISS_SR_ID IN (SELECT PBM_ID FROM ESO_PBM WHERE PBM_TAS_ID ='TPBM12010'  AND PBM_WORK_AREA_CD IN (SELECT COD_ID FROM ECF_CODE WHERE COD_CTY_ID = 'ICMSOL' AND COD_VAL IN (SELECT WFC_COD_ID FROM ESO_WF_CODE WFC WHERE WFC.WFC_TYPE_CD ='JOBCAT' AND WFC_SRC_ID = :12 )))) ) OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TSRM23010' AND ISS_SR_ID IN (SELECT SRM_ID FROM ESO_SRM WHERE SRM_PC_TF = (SELECT WFC_COD_ID FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2205-00010' AND WFC_SRC_ID =  :13  ))) OR (ISS_ASS_EMP_ID IS NULL AND (ISS_SR_ID,ISS_TAS_ID) IN (SELECT EVM_ID,EVM_TAS_ID FROM ESO_EVM WHERE DECODE(EVM_EMP_DPT_ID ,'SM2_BSBK','981','SM1_BSBK','982','SM3_BSBK','983','SM4_BSBK','988','SM5_BSBK','984',EVM_EMP_DPT_ID ) = (SELECT DISTINCT EMP_DPT_ID FROM ESO_WF_CODE EWC , ECF_EMPLOYEE EMP WHERE EWC.WFC_SRC_ID = EMP.EMP_ID AND WFC_COD_ID = 'ITSV2202-01230' AND WFC_TYPE_CD ='JOBCAT' AND WFC_SRC_ID = :14   )  AND EVM_EMP_ID IN (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE EMP_AM_YN IS NULL OR EMP_AM_YN = '0'))) OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID  IN ('TAS03464') AND ISS_SR_ID IN (SELECT wfe_src_id FROM ESO_WF_EMPS ewe  WHERE wfe_type_cd ='CHK_WORK'  AND wfe_emp_id = :15  )) OR (ISS_ASS_EMP_ID IS NULL AND ISS_CAT_CD = 'OCM_LONGTERM100' AND 0 <(SELECT count(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' and WFC_COD_ID = 'ITSV2202-04110' AND WFC_SRC_ID =  :16 ))  OR (ISS_ASS_EMP_ID IS NULL AND ISS_CAT_CD = 'OCM_LONGTERM110' AND 0 <(SELECT count(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' and WFC_COD_ID = 'ITSV2202-03120' AND WFC_SRC_ID = :17 )) OR (ISS_ASS_EMP_ID IS NULL AND ISS_CAT_CD = 'OCM_LONGTERM120' AND 0 <(SELECT count(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' and WFC_COD_ID = 'ITSV2202-03130' AND WFC_SRC_ID = :18 )) OR (ISS_ASS_EMP_ID IS NULL AND ISS_CAT_CD = 'OCM_LONGTERM130' AND 0 <(SELECT count(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' and WFC_COD_ID = 'ITSV2202-03240' AND WFC_SRC_ID = :19 )) OR (ISS_ASS_EMP_ID IS NULL AND ISS_CAT_CD = 'OCM_LONGTERM140' AND 0 <(SELECT count(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' and WFC_COD_ID = 'ITSV2202-03110' AND WFC_SRC_ID = :20 ))  OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TSRM85010' AND ISS_SR_ID IN (SELECT SRM_ID FROM ESO_SRM WHERE SRM_PC_TF = (SELECT WFC_COD_ID FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2205-00010' AND WFC_SRC_ID = :21  ))) OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TICM11010' AND ISS_SR_ID IN (SELECT ICM_ID FROM ESO_ICM WHERE ICM_TAS_ID  = 'TICM11010' AND ((ICM_SOL_CD NOT IN ('ICMSOL05', 'ICMSOL09') AND 0 < (SELECT COUNT(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = (SELECT COD_VAL FROM ECF_CODE WHERE COD_ID = ICM_SOL_CD) AND WFC_SRC_ID = :22  )) OR (ICM_SOL_CD IN ('ICMSOL05') AND ICM_SOL_CD2 IN (SELECT PRO_JOB_ID FROM ECF_PROC WHERE PRO_ROLE_ID = '002' AND PRO_USED = 1 AND PRO_EMP_ID = :23 ))))) )
ORDER BY REQ_DTTM DESC
;

Plan hash value: 3587086750

----------------------------------------------------------------------------------------------------------------------------------------------------
| Id  | Operation                               | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |  OMem |  1Mem | Used-Mem |
----------------------------------------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                        |                     |      1 |        |     28 |00:00:01.86 |   62350 |       |       |          |
|   1 |  TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      3 |      1 |      3 |00:00:00.01 |       5 |       |       |          |
|*  2 |   INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      3 |      1 |      3 |00:00:00.01 |       2 |       |       |          |
|   3 |  SORT AGGREGATE                         |                     |      7 |      1 |      7 |00:00:00.01 |      16 |       |       |          |
|*  4 |   TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      7 |      1 |      7 |00:00:00.01 |      16 |       |       |          |
|*  5 |    INDEX UNIQUE SCAN                    | PK_COD_ID           |      7 |      1 |      7 |00:00:00.01 |       9 |       |       |          |
|   6 |  FAST DUAL                              |                     |     25 |      1 |     25 |00:00:00.01 |       0 |       |       |          |
|   7 |  FAST DUAL                              |                     |     21 |      1 |     21 |00:00:00.01 |       0 |       |       |          |
|   8 |  FAST DUAL                              |                     |     21 |      1 |     21 |00:00:00.01 |       0 |       |       |          |
|   9 |  TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 10 |   INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  11 |  FAST DUAL                              |                     |      2 |      1 |      2 |00:00:00.01 |       0 |       |       |          |
|  12 |  SORT ORDER BY                          |                     |      1 |  54509 |     28 |00:00:01.86 |   62350 | 18432 | 18432 |16384  (0)|
|* 13 |   FILTER                                |                     |      1 |        |     28 |00:00:01.85 |   62196 |       |       |          |
|* 14 |    HASH JOIN                            |                     |      1 |  77087 |  36160 |00:00:00.48 |   15244 |  1236K|  1236K| 1641K (0)|
|* 15 |     HASH JOIN                           |                     |      1 |    605 |    594 |00:00:00.01 |      36 |  1922K|  1922K| 1549K (0)|
|  16 |      NESTED LOOPS                       |                     |      1 |    601 |    613 |00:00:00.01 |      20 |       |       |          |
|  17 |       TABLE ACCESS FULL                 | EWF_ACTIVITY        |      1 |    602 |    637 |00:00:00.01 |      16 |       |       |          |
|* 18 |       INDEX UNIQUE SCAN                 | PK_EWF_WORKFLOW     |    637 |      1 |    613 |00:00:00.01 |       4 |       |       |          |
|* 19 |      TABLE ACCESS FULL                  | EWF_TASK            |      1 |    606 |    612 |00:00:00.01 |      16 |       |       |          |
|* 20 |     TABLE ACCESS FULL                   | ESO_ISSUE           |      1 |    172K|    233K|00:00:00.30 |   15208 |       |       |          |
|* 21 |    FILTER                               |                     |  14378 |        |      0 |00:00:01.07 |   22312 |       |       |          |
|* 22 |     INDEX RANGE SCAN                    | IX_ECF_EMPLOYEE_07  |  14378 |      1 |      0 |00:00:01.06 |   22312 |       |       |          |
|  23 |     TABLE ACCESS BY INDEX ROWID         | EWF_TASK            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 24 |      INDEX UNIQUE SCAN                  | PK_EWF_TASK         |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  25 |    NESTED LOOPS                         |                     |     17 |      1 |      0 |00:00:00.01 |      17 |       |       |          |
|* 26 |     TABLE ACCESS BY INDEX ROWID BATCHED | ECF_EMPLOYEE        |     17 |      1 |      0 |00:00:00.01 |      17 |       |       |          |
|* 27 |      INDEX RANGE SCAN                   | IX_ECF_EMPLOYEE_05  |     17 |      1 |      0 |00:00:00.01 |      17 |       |       |          |
|* 28 |     INDEX RANGE SCAN                    | IX_ECF_MEMBER_01    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  29 |    NESTED LOOPS                         |                     |  20245 |      1 |      0 |00:00:00.09 |   20537 |       |       |          |
|* 30 |     TABLE ACCESS BY INDEX ROWID         | ESO_EVM             |  20245 |      1 |      0 |00:00:00.07 |   20537 |       |       |          |
|* 31 |      INDEX UNIQUE SCAN                  | PK_ESO_EVM          |  20245 |      1 |    287 |00:00:00.05 |   20245 |       |       |          |
|  32 |      SORT UNIQUE NOSORT                 |                     |      1 |      1 |      1 |00:00:00.01 |       4 |       |       |          |
|  33 |       NESTED LOOPS                      |                     |      1 |      1 |      1 |00:00:00.01 |       4 |       |       |          |
|* 34 |        INDEX RANGE SCAN                 | IX_ECF_EMPLOYEE_08  |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|* 35 |        INDEX RANGE SCAN                 | IX01_ESO_WF_CODE    |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|* 36 |     TABLE ACCESS BY INDEX ROWID         | ECF_EMPLOYEE        |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 37 |      INDEX UNIQUE SCAN                  | SYS_C0020079        |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 38 |    INDEX RANGE SCAN                     | IX_ECF_MEMBER_01    |     17 |      1 |      1 |00:00:00.01 |      21 |       |       |          |
|* 39 |    TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_WORKORDER       |    258 |      1 |      0 |00:00:00.01 |    1008 |       |       |          |
|* 40 |     INDEX RANGE SCAN                    | IX_ESO_WORKORDER_03 |    258 |      2 |    546 |00:00:00.01 |     518 |       |       |          |
|  41 |    NESTED LOOPS                         |                     |    264 |      1 |      0 |00:00:00.01 |    2313 |       |       |          |
|  42 |     NESTED LOOPS                        |                     |    264 |      2 |    554 |00:00:00.01 |    1837 |       |       |          |
|* 43 |      TABLE ACCESS BY INDEX ROWID BATCHED| ESO_WORKORDER       |    264 |      2 |    554 |00:00:00.01 |    1031 |       |       |          |
|* 44 |       INDEX RANGE SCAN                  | IX_ESO_WORKORDER_03 |    264 |      2 |    562 |00:00:00.01 |     530 |       |       |          |
|* 45 |      INDEX UNIQUE SCAN                  | SYS_C0020079        |    554 |      1 |    554 |00:00:00.01 |     806 |       |       |          |
|* 46 |     TABLE ACCESS BY INDEX ROWID         | ECF_EMPLOYEE        |    554 |      1 |      0 |00:00:00.01 |     476 |       |       |          |
|* 47 |    TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_CHA             |     69 |      1 |      0 |00:00:00.01 |     212 |       |       |          |
|* 48 |     INDEX RANGE SCAN                    | IX_ESO_CHA01        |     69 |      1 |     71 |00:00:00.01 |     140 |       |       |          |
|  49 |    NESTED LOOPS                         |                     |     69 |      1 |      0 |00:00:00.01 |     424 |       |       |          |
|  50 |     NESTED LOOPS                        |                     |     69 |      1 |     71 |00:00:00.01 |     344 |       |       |          |
|* 51 |      TABLE ACCESS BY INDEX ROWID BATCHED| ESO_CHA             |     69 |      1 |     71 |00:00:00.01 |     212 |       |       |          |
|* 52 |       INDEX RANGE SCAN                  | IX_ESO_CHA01        |     69 |      1 |     71 |00:00:00.01 |     140 |       |       |          |
|* 53 |      INDEX UNIQUE SCAN                  | SYS_C0020079        |     71 |      1 |     71 |00:00:00.01 |     132 |       |       |          |
|* 54 |     TABLE ACCESS BY INDEX ROWID         | ECF_EMPLOYEE        |     71 |      1 |      0 |00:00:00.01 |      80 |       |       |          |
|* 55 |    INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 56 |    INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 57 |    INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 58 |    INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 59 |    INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 60 |    INDEX RANGE SCAN                     | IX01_ESO_WF_EMPS    |     22 |      1 |      1 |00:00:00.01 |      32 |       |       |          |
|* 61 |    FILTER                               |                     |      6 |        |      0 |00:00:00.01 |      23 |       |       |          |
|* 62 |     TABLE ACCESS BY INDEX ROWID BATCHED | ESO_WORKORDER       |      6 |      1 |      0 |00:00:00.01 |      23 |       |       |          |
|* 63 |      INDEX RANGE SCAN                   | IX_ESO_WORKORDER_03 |      6 |      2 |     16 |00:00:00.01 |      12 |       |       |          |
|  64 |     TABLE ACCESS BY INDEX ROWID         | ESO_CHA             |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 65 |      INDEX UNIQUE SCAN                  | PK_ESO_CHA          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 66 |    TABLE ACCESS BY INDEX ROWID          | ESO_SRM             |     11 |      1 |      0 |00:00:00.01 |      46 |       |       |          |
|* 67 |     INDEX UNIQUE SCAN                   | PK_ESO_SRM          |     11 |      1 |     11 |00:00:00.01 |      22 |       |       |          |
|* 68 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      1 |      1 |      0 |00:00:00.01 |       2 |       |       |          |
|* 69 |    TABLE ACCESS BY INDEX ROWID          | ESO_SRM             |      1 |      1 |      0 |00:00:00.01 |       7 |       |       |          |
|* 70 |     INDEX UNIQUE SCAN                   | PK_ESO_SRM          |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|* 71 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      1 |      1 |      0 |00:00:00.01 |       2 |       |       |          |
|* 72 |    FILTER                               |                     |      0 |        |      0 |00:00:00.01 |       0 |       |       |          |
|* 73 |     TABLE ACCESS BY INDEX ROWID BATCHED | ESO_ICM             |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 74 |      INDEX RANGE SCAN                   | PK_ESO_ICM          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 75 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 76 |    TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_PBM             |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 77 |     INDEX RANGE SCAN                    | PK_ESO_PBM          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 78 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  79 |    NESTED LOOPS                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  80 |     NESTED LOOPS                        |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 81 |      TABLE ACCESS BY INDEX ROWID BATCHED| ESO_PBM             |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 82 |       INDEX RANGE SCAN                  | PK_ESO_PBM          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 83 |      TABLE ACCESS BY INDEX ROWID        | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 84 |       INDEX UNIQUE SCAN                 | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 85 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 86 |    FILTER                               |                     |      0 |        |      0 |00:00:00.01 |       0 |       |       |          |
|* 87 |     TABLE ACCESS BY INDEX ROWID BATCHED | ESO_ICM             |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 88 |      INDEX RANGE SCAN                   | PK_ESO_ICM          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 89 |     TABLE ACCESS BY INDEX ROWID BATCHED | ECF_PROC            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 90 |      INDEX RANGE SCAN                   | IX_ECF_PROC_01      |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 91 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  92 |      TABLE ACCESS BY INDEX ROWID        | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 93 |       INDEX UNIQUE SCAN                 | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
----------------------------------------------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - access("A"."ENT_ID"=:B1)
   4 - filter(TO_NUMBER("A"."COD_USED")=1)
   5 - access("A"."COD_ID"=:B1)
  10 - access("A"."WOR_ID"=:B1)
  13 - filter((("ISS_ASS_EMP_ID"=:1 AND "ISS_TAS_ID"<>'TAS03337' AND "ISS_TAS_ID"<>'TCHA13010' AND "ISS_TAS_ID"<>'TAS03336' AND
              "ISS_TAS_ID"<>'TAS03340' AND "ISS_TAS_ID"<>'TCSR13010' AND "ISS_TAS_ID"<>'TAS03165' AND "ISS_TAS_ID"<>'TCSR12010' AND
              "ISS_TAS_ID"<>'TCHA14030' AND "ISS_TAS_ID"<>'TAS03180' AND "ISS_TAS_ID"<>'TAS03197' AND "ISS_TAS_ID"<>'TAS03192' AND
              "ISS_TAS_ID"<>'TAS03223' AND "ISS_TAS_ID"<>'TAS03430' AND "ISS_TAS_ID"<>'TAS03443' AND "ISS_TAS_ID"<>'TAS03449' AND
              "ISS_TAS_ID"<>'TAS03352') OR  IS NOT NULL OR  IS NOT NULL OR ("ISS_ASS_EMP_ID" IS NULL AND  IS NOT NULL) OR ("ISS_TAS_ID"<>'TSRM14010' AND
              IS NOT NULL) OR ("ISS_TAS_ID"='TCHA13010' AND  IS NOT NULL) OR (INTERNAL_FUNCTION("ISS_TAS_ID") AND  IS NOT NULL) OR
              (INTERNAL_FUNCTION("ISS_TAS_ID") AND  IS NOT NULL) OR (INTERNAL_FUNCTION("ISS_TAS_ID") AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND
              "ISS_CAT_CD"='OCM_LONGTERM100' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND "ISS_CAT_CD"='OCM_LONGTERM110' AND  IS NOT NULL) OR
              ("ISS_ASS_EMP_ID" IS NULL AND "ISS_CAT_CD"='OCM_LONGTERM120' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND
              "ISS_CAT_CD"='OCM_LONGTERM130' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND "ISS_CAT_CD"='OCM_LONGTERM140' AND  IS NOT NULL) OR
              ("ISS_ASS_EMP_ID" IS NULL AND "ISS_TAS_ID"='TAS03464' AND  IS NOT NULL) OR ("ISS_TAS_ID"='TCHA14030' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID"
              IS NULL AND "ISS_TAS_ID"='TSRM23010' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND "ISS_TAS_ID"='TSRM85010' AND  IS NOT NULL) OR
              ("ISS_ASS_EMP_ID" IS NULL AND "ISS_TAS_ID"='TAS03415' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND "ISS_TAS_ID"='TPBM11020' AND  IS
              NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND "ISS_TAS_ID"='TPBM12010' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND
              "ISS_TAS_ID"='TICM11010' AND  IS NOT NULL)))
  14 - access("ISS_TAS_ID"="E"."TAS_ID")
  15 - access("E"."TAS_ACT_ID"="A"."ACT_ID")
  18 - access("A"."ACT_WOF_ID"="W"."WOF_ID")
  19 - filter((INTERNAL_FUNCTION("E"."TAS_TYPE") AND "TAS_ENT_ID"<>'UX120'))
  20 - filter((("T"."ISS_APP_ID" IS NULL OR "T"."ISS_APP_ID"<>'pms') AND "T"."ISS_ENT_ID"<>'PFAM' AND "T"."ISS_ENT_ID"<>'PREQ' AND
              "T"."ISS_ENT_ID"<>'PAI' AND "T"."ISS_ENT_ID"<>'PMS' AND "T"."ISS_ENT_ID"<>'PTC' AND "T"."ISS_ENT_ID"<>'PRSK'))
  21 - filter(TO_NUMBER()<>3)
  22 - access("EMP_ID"=:B1 AND "EMP_AGC_EMP_ID"=:7 AND "EMP_AGCFINISH_DTTM">="GET_SYSDATE"() AND "EMP_AGCSTART_DTTM"<="GET_SYSDATE"())
       filter("EMP_AGCFINISH_DTTM">="GET_SYSDATE"())
  24 - access("TAS_ID"=:B1)
  26 - filter(("EMP_AGCSTART_DTTM"<="GET_SYSDATE"() AND "EMP_AGCFINISH_DTTM">="GET_SYSDATE"()))
  27 - access("EMP_AGC_EMP_ID"=:8)
  28 - access("MEM_EMP_ID"="EMP_ID" AND "MEM_WOG_ID"=:B1)
  30 - filter(("EVM_TAS_ID"=:B1 AND DECODE("EVM_EMP_DPT_ID",'SM2_BSBK','981','SM1_BSBK','982','SM3_BSBK','983','SM4_BSBK','988','SM5_BSBK','
              984',"EVM_EMP_DPT_ID")=))
  31 - access("EVM_ID"=:B1)
  34 - access("EMP"."EMP_ID"=:14)
  35 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:14 AND "WFC_COD_ID"='ITSV2202-01230')
  36 - filter(("EMP_AM_YN" IS NULL OR "EMP_AM_YN"='0'))
  37 - access("EVM_EMP_ID"="EMP_ID")
  38 - access("MEM_EMP_ID"=:2 AND "MEM_WOG_ID"=:B1)
  39 - filter(("WOR_ASS_EMP_ID"=:5 AND "WOR_CLA_CD"='CHIWORMH'))
  40 - access("WOR_SRC_ID"=:B1)
  43 - filter(("WOR_CLA_CD"<>'CHIWORHD' AND "WOR_CLA_CD"<>'CHIWORPEER' AND "WOR_CLA_CD"<>'CHIWORFORCE' AND "WOR_CLA_CD"<>'CHIWORSRC'))
  44 - access("WOR_SRC_ID"=:B1)
  45 - access("WOR_ASS_EMP_ID"="EMP_ID")
  46 - filter(("EMP_AGC_EMP_ID"=:9 AND "EMP_AGCSTART_DTTM"<="GET_SYSDATE"() AND "EMP_AGCFINISH_DTTM">="GET_SYSDATE"()))
  47 - filter("CHA_PL_EMP_ID"=:3)
  48 - access("CHA_CSR_ID"=:B1)
  51 - filter("CHA_PL_EMP_ID" IS NOT NULL)
  52 - access("CHA_CSR_ID"=:B1)
  53 - access("CHA_PL_EMP_ID"="EMP_ID")
  54 - filter(("EMP_AGC_EMP_ID"=:4 AND "EMP_AGCSTART_DTTM"<="GET_SYSDATE"() AND "EMP_AGCFINISH_DTTM">="GET_SYSDATE"()))
  55 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:16 AND "WFC_COD_ID"='ITSV2202-04110')
  56 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:17 AND "WFC_COD_ID"='ITSV2202-03120')
  57 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:18 AND "WFC_COD_ID"='ITSV2202-03130')
  58 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:19 AND "WFC_COD_ID"='ITSV2202-03240')
  59 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:20 AND "WFC_COD_ID"='ITSV2202-03110')
  60 - access("WFE_TYPE_CD"='CHK_WORK' AND "WFE_EMP_ID"=:15 AND "WFE_SRC_ID"=:B1)
  61 - filter("WOR_CLA_CD"=CASE  WHEN ((='CHMCAT01') OR (='CHMCAT03') OR (='CHMCAT05') OR (='CHMCAT07')) THEN 'CHIWORMHREAL' ELSE
              'CHIWORMH' END )
  62 - filter("WOR_ASS_EMP_ID"=:6)
  63 - access("WOR_SRC_ID"=:B1)
  65 - access("CHA_ID"=:B1)
  66 - filter("SRM_PC_TF"=)
  67 - access("SRM_ID"=:B1)
  68 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:13 AND "WFC_COD_ID"='ITSV2205-00010')
  69 - filter("SRM_PC_TF"=)
  70 - access("SRM_ID"=:B1)
  71 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:21 AND "WFC_COD_ID"='ITSV2205-00010')
  72 - filter(='ITSV2202-04110')
  73 - filter(("ICM_EIM_ID" IS NOT NULL AND "ICM_TAS_ID"='TAS03415'))
  74 - access("ICM_ID"=:B1)
  75 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:10 AND "WFC_COD_ID"='ITSV2202-04110')
  76 - filter(("PBM_TAS_ID"='TPBM11020' AND "PBM_WOG_TF"=))
  77 - access("PBM_ID"=:B1)
  78 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:11 AND "WFC_COD_ID"='ITSV2202-04110')
  81 - filter(("PBM_TAS_ID"='TPBM12010' AND "PBM_WORK_AREA_CD" IS NOT NULL))
  82 - access("PBM_ID"=:B1)
  83 - filter(("COD_VAL" IS NOT NULL AND "COD_CTY_ID"='ICMSOL'))
  84 - access("PBM_WORK_AREA_CD"="COD_ID")
  85 - access("WFC"."WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:12 AND "COD_VAL"="WFC_COD_ID")
  86 - filter((("ICM_SOL_CD"='ICMSOL05' AND  IS NOT NULL) OR ("ICM_SOL_CD"<>'ICMSOL09' AND "ICM_SOL_CD"<>'ICMSOL05' AND  IS NOT NULL)))
  87 - filter("ICM_TAS_ID"='TICM11010')
  88 - access("ICM_ID"=:B1)
  89 - filter("PRO_JOB_ID"=:B1)
  90 - access("PRO_ROLE_ID"='002' AND "PRO_EMP_ID"=:23)
       filter(TO_NUMBER("PRO_USED")=1)
  91 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:22 AND "WFC_COD_ID"=)
  93 - access("COD_ID"=:B1)




# 튜닝 후 (SQL 및 PLAN) 
-- 튜닝후
SELECT /* 메인 : 나의 할일 리스트 */
      T.ISS_SR_ID AS APR_ID -- ID
    , T.ISS_SR_ID AS ID -- ID
    , E.TAS_ENT_ID AS ENT_ID -- 엔티티 ID
    , case when iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
    else (SELECT NVL(ENT_LABEL, ENT_NAME)
        FROM EFC_ENTITY A
        WHERE A.ENT_ID = E.TAS_ENT_ID) end LOCALE_ENT_NM -- 엔티티명
    , E.TAS_ID -- 단계 ID
    , E.TAS_NAME
    , nvl((SELECT MAX(COD_NAME)
        FROM ECF_CODE A
        WHERE A.COD_USED=1
          AND A.COD_ID=T.ISS_CAT_CD),'-') AS CAT_NAME
--    , (SELECT FM_LDTTM(T.ISS_REQ_DTTM) FROM DUAL) REQ_DTTM -- 요청일
    ,  case when T.ISS_REQ_DTTM is null then null
            else to_char( to_date(T.ISS_REQ_DTTM,'yyyymmddhh24miss'), 'yyyy-mm-dd hh24:mi')
       end    AS REQ_DTTM                                                                   -- modified by exem 241121
--    , (SELECT GET_EMPDPTNAME(T.ISS_REQ_EMP_ID) FROM DUAL) AS REQ_DPT_NAME
--     , (select get_dptname(emp_dpt_id) from ecf_employee where emp_id = T.ISS_REQ_EMP_ID) as REQ_DPT_NAME  -- modified by exem 241121
     , (select ( select dpt_name from ecf_dept where dpt_id = emp_dpt_id ) from ecf_employee where emp_id = T.ISS_REQ_EMP_ID) as REQ_DPT_NAME  -- modified by exem 241121
--    , (SELECT GET_EMPNAME(T.ISS_REQ_EMP_ID) FROM DUAL) AS REQ_EMP_NAME
    , (select emp_name from ecf_employee where emp_id= T.ISS_REQ_EMP_ID)  as REQ_EMP_NAME   -- modified by exem 241121
    --, SUBSTR(iss_src_id,1,3) as src_id -- 운영동기화
    --,CASE T.ISS_REQ_TITLE WHEN '' THEN '제목없음' ELSE T.ISS_REQ_TITLE END AS REQ_TITLE -- 제목
    , CASE
        WHEN T.ISS_REQ_TITLE = '' THEN '제목없음'
        WHEN T.ISS_CAT_CD ='WORCAT03' AND ISS_TAS_ID IN ('TAS03292','TAS03203')
        THEN (SELECT WOR_FORCE_NUM
                FROM ESO_WORKORDER A
                WHERE A.WOR_ID = T.ISS_SR_ID )
        ELSE T.ISS_REQ_TITLE
        END AS REQ_TITLE -- 제목
    , (SELECT GET_EMPNAME(ISS_ASS_EMP_ID) FROM DUAL) AS ASS_NAME
    , 'FORM' AS T_TYPE
    , '' AS API_ID
    , CASE
        WHEN TO_DATE(SUBSTR(T.ISS_DEAD_DTTM, 1, 8), 'YYYYMMDD') - TO_DATE(TO_CHAR(SYSDATE, 'YYYYMMDD'), 'YYYYMMDD') BETWEEN 0 AND 2 THEN 'G'
        WHEN TO_DATE(SUBSTR(T.ISS_DEAD_DTTM, 1, 8), 'YYYYMMDD') < TO_DATE(TO_CHAR(SYSDATE, 'YYYYMMDD'), 'YYYYMMDD') THEN 'R'
        ELSE ''
        END AS TEXT_COLOR
FROM ESO_ISSUE T
   , EWF_TASK E
   , EWF_ACTIVITY A
   , EWF_WORKFLOW W
WHERE T.ISS_TAS_ID = E.TAS_ID
  AND TAS_ENT_ID NOT IN ('UX120')
  AND E.TAS_TYPE IN ('1','2','4') -- 타스크 유형(접수,처리)
  AND E.TAS_ACT_ID = A.ACT_ID
  AND A.ACT_WOF_ID = W.WOF_ID
  --AND T.ISS_REG_DTTM >= TO_CHAR(SYSDATE - 31, 'YYYYMMDDHH24MISS') -- 최근 한달간
  AND (T.ISS_APP_ID <> 'pms' OR T.ISS_APP_ID IS NULL)
  AND T.ISS_ENT_ID NOT IN ('PMS', 'PTC', 'PRSK', 'PREQ', 'PFAM', 'PAI')
  and  ((ISS_ASS_EMP_ID =  :1  AND ISS_TAS_ID NOT IN ('TAS03165','TCSR12010','TCSR13010','TCHA13010','TCHA14030','TAS03180','TAS03197','TAS03192','TAS03223','TAS03430','TAS03443','TAS03340','TAS03336','TAS03337','TAS03449','TAS03352')) OR (ISS_ASS_WOG_ID IN ( SELECT MEM_WOG_ID FROM ECF_MEMBER WHERE MEM_EMP_ID =   :2    ) AND ISS_TAS_ID NOT IN ('TSRM14010')) OR (ISS_SR_ID IN (SELECT CHA_CSR_ID FROM ESO_CHA WHERE CHA_PL_EMP_ID =  :3  ) AND ISS_TAS_ID IN ('TAS03165','TCSR12010')) OR (ISS_SR_ID IN (SELECT CHA_CSR_ID FROM ESO_CHA WHERE CHA_PL_EMP_ID IN (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE TO_CHAR(SYSDATE,'yyyymmddhh24miss') BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM AND EMP_AGC_EMP_ID = :4 )) AND ISS_TAS_ID IN ('TAS03165', 'TCSR12010')) or (ISS_SR_ID IN (SELECT WOR_SRC_ID FROM ESO_WORKORDER WHERE WOR_CLA_CD IN ('CHIWORMH') AND WOR_ASS_EMP_ID = :5 ) AND ISS_TAS_ID IN ('TCHA13010')) OR (ISS_SR_ID IN (SELECT WOR_SRC_ID FROM ESO_WORKORDER WHERE WOR_CLA_CD = CASE WHEN (SELECT CHA_CAT_CD FROM ESO_CHA WHERE CHA_ID = ISS_SR_ID) IN ('CHMCAT01','CHMCAT03','CHMCAT05','CHMCAT07') THEN 'CHIWORMHREAL' ELSE 'CHIWORMH' END AND WOR_ASS_EMP_ID = :6 ) AND ISS_TAS_ID IN ('TCHA14030'))OR (ISS_ASS_EMP_ID IN (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE EMP_AGC_EMP_ID = :7  AND  TO_CHAR(SYSDATE,'yyyymmddhh24miss')   BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM AND 3 != (SELECT TAS_TYPE FROM EWF_TASK WHERE TAS_ID = ISS_TAS_ID))) OR (ISS_ASS_WOG_ID IN (SELECT MEM_WOG_ID FROM ECF_MEMBER WHERE MEM_EMP_ID in (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE TO_CHAR(SYSDATE,'yyyymmddhh24miss') BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM AND EMP_AGC_EMP_ID = :8 ))) OR (ISS_TAS_ID IN ('TCHA13010', 'TCHA14030') AND ISS_SR_ID IN (SELECT WOR_SRC_ID FROM ESO_WORKORDER WHERE WOR_ASS_EMP_ID in (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE TO_CHAR(SYSDATE,'yyyymmddhh24miss') BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM AND EMP_AGC_EMP_ID = :9 )AND WOR_CLA_CD NOT IN ('CHIWORHD','CHIWORPEER','CHIWORSRC','CHIWORFORCE'))) OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TAS03415' AND ISS_SR_ID IN (SELECT ICM_ID FROM ESO_ICM WHERE ICM_TAS_ID ='TAS03415' AND ICM_EIM_ID IS NOT NULL  AND 'ITSV2202-04110' = (SELECT WFC_COD_ID FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-04110' AND WFC_SRC_ID =  :10  ))) OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TPBM11020' AND ISS_SR_ID IN (SELECT PBM_ID FROM ESO_PBM WHERE PBM_TAS_ID ='TPBM11020' AND PBM_WOG_TF = (SELECT WFC_COD_ID FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-04110' AND WFC_SRC_ID =  :11  )) OR (T.ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TPBM12010' AND  ISS_SR_ID IN (SELECT PBM_ID FROM ESO_PBM WHERE PBM_TAS_ID ='TPBM12010'  AND PBM_WORK_AREA_CD IN (SELECT COD_ID FROM ECF_CODE WHERE COD_CTY_ID = 'ICMSOL' AND COD_VAL IN (SELECT WFC_COD_ID FROM ESO_WF_CODE WFC WHERE WFC.WFC_TYPE_CD ='JOBCAT' AND WFC_SRC_ID = :12 )))) ) OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TSRM23010' AND ISS_SR_ID IN (SELECT SRM_ID FROM ESO_SRM WHERE SRM_PC_TF = (SELECT WFC_COD_ID FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2205-00010' AND WFC_SRC_ID =  :13  ))) OR (ISS_ASS_EMP_ID IS NULL AND (ISS_SR_ID,ISS_TAS_ID) IN (SELECT EVM_ID,EVM_TAS_ID FROM ESO_EVM WHERE DECODE(EVM_EMP_DPT_ID ,'SM2_BSBK','981','SM1_BSBK','982','SM3_BSBK','983','SM4_BSBK','988','SM5_BSBK','984',EVM_EMP_DPT_ID ) = (SELECT DISTINCT EMP_DPT_ID FROM ESO_WF_CODE EWC , ECF_EMPLOYEE EMP WHERE EWC.WFC_SRC_ID = EMP.EMP_ID AND WFC_COD_ID = 'ITSV2202-01230' AND WFC_TYPE_CD ='JOBCAT' AND WFC_SRC_ID = :14   )  AND EVM_EMP_ID IN (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE EMP_AM_YN IS NULL OR EMP_AM_YN = '0'))) OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID  IN ('TAS03464') AND ISS_SR_ID IN (SELECT wfe_src_id FROM ESO_WF_EMPS ewe  WHERE wfe_type_cd ='CHK_WORK'  AND wfe_emp_id = :15  )) OR (ISS_ASS_EMP_ID IS NULL AND ISS_CAT_CD = 'OCM_LONGTERM100' AND 0 <(SELECT count(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' and WFC_COD_ID = 'ITSV2202-04110' AND WFC_SRC_ID =  :16 ))  OR (ISS_ASS_EMP_ID IS NULL AND ISS_CAT_CD = 'OCM_LONGTERM110' AND 0 <(SELECT count(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' and WFC_COD_ID = 'ITSV2202-03120' AND WFC_SRC_ID = :17 )) OR (ISS_ASS_EMP_ID IS NULL AND ISS_CAT_CD = 'OCM_LONGTERM120' AND 0 <(SELECT count(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' and WFC_COD_ID = 'ITSV2202-03130' AND WFC_SRC_ID = :18 )) OR (ISS_ASS_EMP_ID IS NULL AND ISS_CAT_CD = 'OCM_LONGTERM130' AND 0 <(SELECT count(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' and WFC_COD_ID = 'ITSV2202-03240' AND WFC_SRC_ID = :19 )) OR (ISS_ASS_EMP_ID IS NULL AND ISS_CAT_CD = 'OCM_LONGTERM140' AND 0 <(SELECT count(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' and WFC_COD_ID = 'ITSV2202-03110' AND WFC_SRC_ID = :20 ))  OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TSRM85010' AND ISS_SR_ID IN (SELECT SRM_ID FROM ESO_SRM WHERE SRM_PC_TF = (SELECT WFC_COD_ID FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2205-00010' AND WFC_SRC_ID = :21  ))) OR (ISS_ASS_EMP_ID IS NULL AND ISS_TAS_ID = 'TICM11010' AND ISS_SR_ID IN (SELECT ICM_ID FROM ESO_ICM WHERE ICM_TAS_ID  = 'TICM11010' AND ((ICM_SOL_CD NOT IN ('ICMSOL05', 'ICMSOL09') AND 0 < (SELECT COUNT(1) FROM ESO_WF_CODE WHERE WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = (SELECT COD_VAL FROM ECF_CODE WHERE COD_ID = ICM_SOL_CD) AND WFC_SRC_ID = :22  )) OR (ICM_SOL_CD IN ('ICMSOL05') AND ICM_SOL_CD2 IN (SELECT PRO_JOB_ID FROM ECF_PROC WHERE PRO_ROLE_ID = '002' AND PRO_USED = 1 AND PRO_EMP_ID = :23 ))))) )
ORDER BY REQ_DTTM DESC
;




Plan hash value: 3856812218

----------------------------------------------------------------------------------------------------------------------------------------------------
| Id  | Operation                               | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |  OMem |  1Mem | Used-Mem |
----------------------------------------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                        |                     |      1 |        |     28 |00:00:00.79 |   61658 |       |       |          |
|   1 |  TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      3 |      1 |      3 |00:00:00.01 |       5 |       |       |          |
|*  2 |   INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      3 |      1 |      3 |00:00:00.01 |       2 |       |       |          |
|   3 |  SORT AGGREGATE                         |                     |      7 |      1 |      7 |00:00:00.01 |      16 |       |       |          |
|*  4 |   TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      7 |      1 |      7 |00:00:00.01 |      16 |       |       |          |
|*  5 |    INDEX UNIQUE SCAN                    | PK_COD_ID           |      7 |      1 |      7 |00:00:00.01 |       9 |       |       |          |
|   6 |  TABLE ACCESS BY INDEX ROWID            | ECF_DEPT            |     16 |      1 |     15 |00:00:00.01 |      24 |       |       |          |
|*  7 |   INDEX UNIQUE SCAN                     | PK_ECF_DEPT         |     16 |      1 |     15 |00:00:00.01 |       4 |       |       |          |
|*  8 |  INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_08  |     21 |      1 |     21 |00:00:00.01 |      23 |       |       |          |
|*  9 |  INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |     21 |      1 |     21 |00:00:00.01 |      23 |       |       |          |
|  10 |  TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 11 |   INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  12 |  FAST DUAL                              |                     |      2 |      1 |      2 |00:00:00.01 |       0 |       |       |          |
|  13 |  SORT ORDER BY                          |                     |      1 |  54509 |     28 |00:00:00.79 |   61658 |  9216 |  9216 | 8192  (0)|
|* 14 |   FILTER                                |                     |      1 |        |     28 |00:00:00.78 |   61565 |       |       |          |
|* 15 |    HASH JOIN                            |                     |      1 |  77087 |  36164 |00:00:00.46 |   15244 |  1236K|  1236K| 1685K (0)|
|* 16 |     HASH JOIN                           |                     |      1 |    605 |    594 |00:00:00.01 |      36 |  1922K|  1922K| 1635K (0)|
|  17 |      NESTED LOOPS                       |                     |      1 |    601 |    613 |00:00:00.01 |      20 |       |       |          |
|  18 |       TABLE ACCESS FULL                 | EWF_ACTIVITY        |      1 |    602 |    637 |00:00:00.01 |      16 |       |       |          |
|* 19 |       INDEX UNIQUE SCAN                 | PK_EWF_WORKFLOW     |    637 |      1 |    613 |00:00:00.01 |       4 |       |       |          |
|* 20 |      TABLE ACCESS FULL                  | EWF_TASK            |      1 |    606 |    612 |00:00:00.01 |      16 |       |       |          |
|* 21 |     TABLE ACCESS FULL                   | ESO_ISSUE           |      1 |    172K|    233K|00:00:00.28 |   15208 |       |       |          |
|* 22 |    FILTER                               |                     |  14382 |        |      0 |00:00:00.07 |   22324 |       |       |          |
|* 23 |     INDEX RANGE SCAN                    | IX_ECF_EMPLOYEE_07  |  14382 |      1 |      0 |00:00:00.05 |   22324 |       |       |          |
|  24 |     TABLE ACCESS BY INDEX ROWID         | EWF_TASK            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 25 |      INDEX UNIQUE SCAN                  | PK_EWF_TASK         |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  26 |    NESTED LOOPS                         |                     |     15 |      1 |      0 |00:00:00.01 |      15 |       |       |          |
|* 27 |     TABLE ACCESS BY INDEX ROWID BATCHED | ECF_EMPLOYEE        |     15 |      1 |      0 |00:00:00.01 |      15 |       |       |          |
|* 28 |      INDEX RANGE SCAN                   | IX_ECF_EMPLOYEE_05  |     15 |      1 |      0 |00:00:00.01 |      15 |       |       |          |
|* 29 |     INDEX RANGE SCAN                    | IX_ECF_MEMBER_01    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  30 |    NESTED LOOPS                         |                     |  20234 |      1 |      0 |00:00:00.09 |   20526 |       |       |          |
|* 31 |     TABLE ACCESS BY INDEX ROWID         | ESO_EVM             |  20234 |      1 |      0 |00:00:00.07 |   20526 |       |       |          |
|* 32 |      INDEX UNIQUE SCAN                  | PK_ESO_EVM          |  20234 |      1 |    287 |00:00:00.04 |   20234 |       |       |          |
|  33 |      SORT UNIQUE NOSORT                 |                     |      1 |      1 |      1 |00:00:00.01 |       4 |       |       |          |
|  34 |       NESTED LOOPS                      |                     |      1 |      1 |      1 |00:00:00.01 |       4 |       |       |          |
|* 35 |        INDEX RANGE SCAN                 | IX_ECF_EMPLOYEE_08  |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|* 36 |        INDEX RANGE SCAN                 | IX01_ESO_WF_CODE    |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|* 37 |     TABLE ACCESS BY INDEX ROWID         | ECF_EMPLOYEE        |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 38 |      INDEX UNIQUE SCAN                  | SYS_C0020079        |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 39 |    INDEX RANGE SCAN                     | IX_ECF_MEMBER_01    |     15 |      1 |      1 |00:00:00.01 |      19 |       |       |          |
|* 40 |    TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_WORKORDER       |    249 |      1 |      0 |00:00:00.01 |     973 |       |       |          |
|* 41 |     INDEX RANGE SCAN                    | IX_ESO_WORKORDER_03 |    249 |      2 |    528 |00:00:00.01 |     499 |       |       |          |
|  42 |    NESTED LOOPS                         |                     |    257 |      1 |      0 |00:00:00.01 |    1810 |       |       |          |
|* 43 |     TABLE ACCESS BY INDEX ROWID BATCHED | ESO_WORKORDER       |    257 |      2 |    544 |00:00:00.01 |    1005 |       |       |          |
|* 44 |      INDEX RANGE SCAN                   | IX_ESO_WORKORDER_03 |    257 |      2 |    552 |00:00:00.01 |     515 |       |       |          |
|* 45 |     INDEX RANGE SCAN                    | IX_ECF_EMPLOYEE_07  |    544 |      1 |      0 |00:00:00.01 |     805 |       |       |          |
|* 46 |    TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_CHA             |     69 |      1 |      0 |00:00:00.01 |     209 |       |       |          |
|* 47 |     INDEX RANGE SCAN                    | IX_ESO_CHA01        |     69 |      1 |     70 |00:00:00.01 |     139 |       |       |          |
|  48 |    NESTED LOOPS                         |                     |     69 |      1 |      0 |00:00:00.01 |     341 |       |       |          |
|* 49 |     TABLE ACCESS BY INDEX ROWID BATCHED | ESO_CHA             |     69 |      1 |     70 |00:00:00.01 |     209 |       |       |          |
|* 50 |      INDEX RANGE SCAN                   | IX_ESO_CHA01        |     69 |      1 |     70 |00:00:00.01 |     139 |       |       |          |
|* 51 |     INDEX RANGE SCAN                    | IX_ECF_EMPLOYEE_07  |     70 |      1 |      0 |00:00:00.01 |     132 |       |       |          |
|* 52 |    INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 53 |    INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 54 |    INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 55 |    INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 56 |    INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 57 |    INDEX RANGE SCAN                     | IX01_ESO_WF_EMPS    |     21 |      1 |      1 |00:00:00.01 |      31 |       |       |          |
|* 58 |    FILTER                               |                     |      8 |        |      0 |00:00:00.01 |      32 |       |       |          |
|* 59 |     TABLE ACCESS BY INDEX ROWID BATCHED | ESO_WORKORDER       |      8 |      1 |      0 |00:00:00.01 |      32 |       |       |          |
|* 60 |      INDEX RANGE SCAN                   | IX_ESO_WORKORDER_03 |      8 |      2 |     24 |00:00:00.01 |      16 |       |       |          |
|  61 |     TABLE ACCESS BY INDEX ROWID         | ESO_CHA             |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 62 |      INDEX UNIQUE SCAN                  | PK_ESO_CHA          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 63 |    TABLE ACCESS BY INDEX ROWID          | ESO_SRM             |      8 |      1 |      0 |00:00:00.01 |      34 |       |       |          |
|* 64 |     INDEX UNIQUE SCAN                   | PK_ESO_SRM          |      8 |      1 |      8 |00:00:00.01 |      16 |       |       |          |
|* 65 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      1 |      1 |      0 |00:00:00.01 |       2 |       |       |          |
|* 66 |    TABLE ACCESS BY INDEX ROWID          | ESO_SRM             |      1 |      1 |      0 |00:00:00.01 |       7 |       |       |          |
|* 67 |     INDEX UNIQUE SCAN                   | PK_ESO_SRM          |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|* 68 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      1 |      1 |      0 |00:00:00.01 |       2 |       |       |          |
|* 69 |    FILTER                               |                     |      0 |        |      0 |00:00:00.01 |       0 |       |       |          |
|* 70 |     TABLE ACCESS BY INDEX ROWID BATCHED | ESO_ICM             |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 71 |      INDEX RANGE SCAN                   | PK_ESO_ICM          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 72 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 73 |    TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_PBM             |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 74 |     INDEX RANGE SCAN                    | PK_ESO_PBM          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 75 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  76 |    NESTED LOOPS                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  77 |     NESTED LOOPS                        |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 78 |      TABLE ACCESS BY INDEX ROWID BATCHED| ESO_PBM             |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 79 |       INDEX RANGE SCAN                  | PK_ESO_PBM          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 80 |      TABLE ACCESS BY INDEX ROWID        | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 81 |       INDEX UNIQUE SCAN                 | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 82 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 83 |    FILTER                               |                     |      0 |        |      0 |00:00:00.01 |       0 |       |       |          |
|* 84 |     TABLE ACCESS BY INDEX ROWID BATCHED | ESO_ICM             |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 85 |      INDEX RANGE SCAN                   | PK_ESO_ICM          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 86 |     TABLE ACCESS BY INDEX ROWID BATCHED | ECF_PROC            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 87 |      INDEX RANGE SCAN                   | IX_ECF_PROC_01      |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 88 |     INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  89 |      TABLE ACCESS BY INDEX ROWID        | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 90 |       INDEX UNIQUE SCAN                 | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
----------------------------------------------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - access("A"."ENT_ID"=:B1)
   4 - filter(TO_NUMBER("A"."COD_USED")=1)
   5 - access("A"."COD_ID"=:B1)
   7 - access("DPT_ID"=:B1)
   8 - access("EMP_ID"=:B1)
   9 - access("EMP_ID"=:B1)
  11 - access("A"."WOR_ID"=:B1)
  14 - filter((("ISS_ASS_EMP_ID"=:1 AND "ISS_TAS_ID"<>'TAS03337' AND "ISS_TAS_ID"<>'TCHA13010' AND "ISS_TAS_ID"<>'TAS03336' AND
              "ISS_TAS_ID"<>'TAS03340' AND "ISS_TAS_ID"<>'TCSR13010' AND "ISS_TAS_ID"<>'TAS03165' AND "ISS_TAS_ID"<>'TCSR12010' AND
              "ISS_TAS_ID"<>'TCHA14030' AND "ISS_TAS_ID"<>'TAS03180' AND "ISS_TAS_ID"<>'TAS03197' AND "ISS_TAS_ID"<>'TAS03192' AND
              "ISS_TAS_ID"<>'TAS03223' AND "ISS_TAS_ID"<>'TAS03430' AND "ISS_TAS_ID"<>'TAS03443' AND "ISS_TAS_ID"<>'TAS03449' AND
              "ISS_TAS_ID"<>'TAS03352') OR  IS NOT NULL OR  IS NOT NULL OR ("ISS_ASS_EMP_ID" IS NULL AND  IS NOT NULL) OR ("ISS_TAS_ID"<>'TSRM14010' AND
              IS NOT NULL) OR ("ISS_TAS_ID"='TCHA13010' AND  IS NOT NULL) OR (INTERNAL_FUNCTION("ISS_TAS_ID") AND  IS NOT NULL) OR
              (INTERNAL_FUNCTION("ISS_TAS_ID") AND  IS NOT NULL) OR (INTERNAL_FUNCTION("ISS_TAS_ID") AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND
              "ISS_CAT_CD"='OCM_LONGTERM100' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND "ISS_CAT_CD"='OCM_LONGTERM110' AND  IS NOT NULL) OR
              ("ISS_ASS_EMP_ID" IS NULL AND "ISS_CAT_CD"='OCM_LONGTERM120' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND
              "ISS_CAT_CD"='OCM_LONGTERM130' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND "ISS_CAT_CD"='OCM_LONGTERM140' AND  IS NOT NULL) OR
              ("ISS_ASS_EMP_ID" IS NULL AND "ISS_TAS_ID"='TAS03464' AND  IS NOT NULL) OR ("ISS_TAS_ID"='TCHA14030' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID"
              IS NULL AND "ISS_TAS_ID"='TSRM23010' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND "ISS_TAS_ID"='TSRM85010' AND  IS NOT NULL) OR
              ("ISS_ASS_EMP_ID" IS NULL AND "ISS_TAS_ID"='TAS03415' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND "ISS_TAS_ID"='TPBM11020' AND  IS
              NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND "ISS_TAS_ID"='TPBM12010' AND  IS NOT NULL) OR ("ISS_ASS_EMP_ID" IS NULL AND
              "ISS_TAS_ID"='TICM11010' AND  IS NOT NULL)))
  15 - access("ISS_TAS_ID"="E"."TAS_ID")
  16 - access("E"."TAS_ACT_ID"="A"."ACT_ID")
  19 - access("A"."ACT_WOF_ID"="W"."WOF_ID")
  20 - filter((INTERNAL_FUNCTION("E"."TAS_TYPE") AND "TAS_ENT_ID"<>'UX120'))
  21 - filter((("T"."ISS_APP_ID" IS NULL OR "T"."ISS_APP_ID"<>'pms') AND "T"."ISS_ENT_ID"<>'PFAM' AND "T"."ISS_ENT_ID"<>'PREQ' AND
              "T"."ISS_ENT_ID"<>'PAI' AND "T"."ISS_ENT_ID"<>'PMS' AND "T"."ISS_ENT_ID"<>'PTC' AND "T"."ISS_ENT_ID"<>'PRSK'))
  22 - filter(TO_NUMBER()<>3)
  23 - access("EMP_ID"=:B1 AND "EMP_AGC_EMP_ID"=:7 AND "EMP_AGCFINISH_DTTM">=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss') AND
              "EMP_AGCSTART_DTTM"<=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss'))
       filter("EMP_AGCFINISH_DTTM">=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss'))
  25 - access("TAS_ID"=:B1)
  27 - filter(("EMP_AGCFINISH_DTTM">=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss') AND "EMP_AGCSTART_DTTM"<=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss')))
  28 - access("EMP_AGC_EMP_ID"=:8)
  29 - access("MEM_EMP_ID"="EMP_ID" AND "MEM_WOG_ID"=:B1)
  31 - filter(("EVM_TAS_ID"=:B1 AND DECODE("EVM_EMP_DPT_ID",'SM2_BSBK','981','SM1_BSBK','982','SM3_BSBK','983','SM4_BSBK','988','SM5_BSBK','
              984',"EVM_EMP_DPT_ID")=))
  32 - access("EVM_ID"=:B1)
  35 - access("EMP"."EMP_ID"=:14)
  36 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:14 AND "WFC_COD_ID"='ITSV2202-01230')
  37 - filter(("EMP_AM_YN" IS NULL OR "EMP_AM_YN"='0'))
  38 - access("EVM_EMP_ID"="EMP_ID")
  39 - access("MEM_EMP_ID"=:2 AND "MEM_WOG_ID"=:B1)
  40 - filter(("WOR_ASS_EMP_ID"=:5 AND "WOR_CLA_CD"='CHIWORMH'))
  41 - access("WOR_SRC_ID"=:B1)
  43 - filter(("WOR_CLA_CD"<>'CHIWORHD' AND "WOR_CLA_CD"<>'CHIWORPEER' AND "WOR_CLA_CD"<>'CHIWORFORCE' AND "WOR_CLA_CD"<>'CHIWORSRC'))
  44 - access("WOR_SRC_ID"=:B1)
  45 - access("WOR_ASS_EMP_ID"="EMP_ID" AND "EMP_AGC_EMP_ID"=:9 AND "EMP_AGCFINISH_DTTM">=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss') AND
              "EMP_AGCSTART_DTTM"<=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss'))
       filter("EMP_AGCFINISH_DTTM">=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss'))
  46 - filter("CHA_PL_EMP_ID"=:3)
  47 - access("CHA_CSR_ID"=:B1)
  49 - filter("CHA_PL_EMP_ID" IS NOT NULL)
  50 - access("CHA_CSR_ID"=:B1)
  51 - access("CHA_PL_EMP_ID"="EMP_ID" AND "EMP_AGC_EMP_ID"=:4 AND "EMP_AGCFINISH_DTTM">=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss') AND
              "EMP_AGCSTART_DTTM"<=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss'))
       filter("EMP_AGCFINISH_DTTM">=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss'))
  52 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:16 AND "WFC_COD_ID"='ITSV2202-04110')
  53 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:17 AND "WFC_COD_ID"='ITSV2202-03120')
  54 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:18 AND "WFC_COD_ID"='ITSV2202-03130')
  55 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:19 AND "WFC_COD_ID"='ITSV2202-03240')
  56 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:20 AND "WFC_COD_ID"='ITSV2202-03110')
  57 - access("WFE_TYPE_CD"='CHK_WORK' AND "WFE_EMP_ID"=:15 AND "WFE_SRC_ID"=:B1)
  58 - filter("WOR_CLA_CD"=CASE  WHEN ((='CHMCAT01') OR (='CHMCAT03') OR (='CHMCAT05') OR (='CHMCAT07')) THEN 'CHIWORMHREAL' ELSE
              'CHIWORMH' END )
  59 - filter("WOR_ASS_EMP_ID"=:6)
  60 - access("WOR_SRC_ID"=:B1)
  62 - access("CHA_ID"=:B1)
  63 - filter("SRM_PC_TF"=)
  64 - access("SRM_ID"=:B1)
  65 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:13 AND "WFC_COD_ID"='ITSV2205-00010')
  66 - filter("SRM_PC_TF"=)
  67 - access("SRM_ID"=:B1)
  68 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:21 AND "WFC_COD_ID"='ITSV2205-00010')
  69 - filter(='ITSV2202-04110')
  70 - filter(("ICM_EIM_ID" IS NOT NULL AND "ICM_TAS_ID"='TAS03415'))
  71 - access("ICM_ID"=:B1)
  72 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:10 AND "WFC_COD_ID"='ITSV2202-04110')
  73 - filter(("PBM_TAS_ID"='TPBM11020' AND "PBM_WOG_TF"=))
  74 - access("PBM_ID"=:B1)
  75 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:11 AND "WFC_COD_ID"='ITSV2202-04110')
  78 - filter(("PBM_TAS_ID"='TPBM12010' AND "PBM_WORK_AREA_CD" IS NOT NULL))
  79 - access("PBM_ID"=:B1)
  80 - filter(("COD_VAL" IS NOT NULL AND "COD_CTY_ID"='ICMSOL'))
  81 - access("PBM_WORK_AREA_CD"="COD_ID")
  82 - access("WFC"."WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:12 AND "COD_VAL"="WFC_COD_ID")
  83 - filter((("ICM_SOL_CD"='ICMSOL05' AND  IS NOT NULL) OR ("ICM_SOL_CD"<>'ICMSOL09' AND "ICM_SOL_CD"<>'ICMSOL05' AND  IS NOT NULL)))
  84 - filter("ICM_TAS_ID"='TICM11010')
  85 - access("ICM_ID"=:B1)
  86 - filter("PRO_JOB_ID"=:B1)
  87 - access("PRO_ROLE_ID"='002' AND "PRO_EMP_ID"=:23)
       filter(TO_NUMBER("PRO_USED")=1)
  88 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_SRC_ID"=:22 AND "WFC_COD_ID"=)
  90 - access("COD_ID"=:B1)


