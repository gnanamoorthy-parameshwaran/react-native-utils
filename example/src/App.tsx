import {Button, Text, StyleSheet, ScrollView, SafeAreaView} from 'react-native';
import useAddress from './generated/clients/V1/Address/useAddress';
import React from 'react';

export default function App() {
    const [result, setResult] = React.useState<any>(null);
    const {getAddress, gettingAddress} = useAddress();

    return (
        <SafeAreaView style={styles.container}>
            <Text>react-native-utils</Text>
            <Button title={gettingAddress ? 'Loading...' : 'Fetch address'} onPress={() => getAddress({address: 1}).then(res => setResult(res))} />

            <ScrollView contentContainerStyle={{flexGrow: 1}}>
                <Text>Result</Text>
                <Text>{JSON.stringify(result, null, 4)}</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        gap: 10,
        padding: 10,
        paddingTop: 50,
        justifyContent: 'center',
    },
});
