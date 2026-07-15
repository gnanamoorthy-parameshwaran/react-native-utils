import {Button, Text, View, StyleSheet} from 'react-native';
import useAddress from './generated/clients/V1/Address/useAddress';

export default function App() {
    const {getAddress, gettingAddress} = useAddress();

    return (
        <View style={styles.container}>
            <Text>react-native-utils</Text>
            <Button title={gettingAddress ? 'Loading...' : 'Fetch address'} onPress={() => getAddress({address: 1})} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
