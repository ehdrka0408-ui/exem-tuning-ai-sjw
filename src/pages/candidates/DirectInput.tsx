import { useNavigate } from 'react-router-dom'
import DirectInputForm from '../../components/common/DirectInputForm'

export default function DirectInput() {
  const navigate = useNavigate()

  return (
    <DirectInputForm
      onCreated={(workItemId) => navigate(`/work/${workItemId}`)}
      onNavigateToExisting={(workItemId) => navigate(`/work/${workItemId}`)}
    />
  )
}
